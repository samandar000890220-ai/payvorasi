import { EventEmitter } from 'node:events';
import { randomUUID } from "node:crypto";
import type { SpeechToTextProvider, RealtimeVoiceProvider, TextToSpeechProvider } from './providers';

export type VoiceState =
  | 'idle'
  | 'requesting_permission'
  | 'connecting'
  | 'listening'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface VoiceSessionInfo {
  id: string;
  state: VoiceState;
  createdAt: number;
  provider?: string;
}

export class VoiceEngineError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'VoiceEngineError';
    this.code = code;
  }
}

export class VoiceEngineService extends EventEmitter {
  private speechProvider: SpeechToTextProvider | null;
  private realtimeProvider: RealtimeVoiceProvider | null;
  private ttsProvider: TextToSpeechProvider | null;
  private sessions: Map<string, VoiceSessionInfo> = new Map();
  private state: VoiceState = 'idle';

  private providerListeners: Map<string, (() => void)[]> = new Map()

  constructor(opts?: { speech?: SpeechToTextProvider; realtime?: RealtimeVoiceProvider; tts?: TextToSpeechProvider }) {
    super();
    this.speechProvider = opts?.speech ?? null;
    this.realtimeProvider = opts?.realtime ?? null;
    this.ttsProvider = opts?.tts ?? null;
  }

  getState(): VoiceState { return this.state; }

  private setState(s: VoiceState) {
    this.state = s;
    this.emit('state.changed', s);
  }

  async transcribe(audio: Buffer): Promise<string> {
    if (!this.speechProvider || !this.speechProvider.configured) {
      throw new VoiceEngineError('no_provider', 'No STT provider configured.');
    }
    this.setState('transcribing');
    this.emit('transcription.started');
    try {
      const text = await this.speechProvider.transcribe(audio);
      this.emit('transcription.completed', text);
      this.setState('idle');
      return text;
    } catch (err) {
      this.emit('transcription.failed', err);
      this.setState('error');
      throw new VoiceEngineError('stt_failure', (err instanceof Error) ? err.message : String(err));
    }
  }

  async startVoiceSession(options?: Record<string, unknown>): Promise<VoiceSessionInfo> {
    if (!this.realtimeProvider || !this.realtimeProvider.configured) {
      // Still create a logical session for local orchestration even if realtime absent.
      const id = randomUUID();
      const session: VoiceSessionInfo = { id, state: 'listening', createdAt: Date.now() };
      this.sessions.set(id, session);
      this.emit('session.created', session);
      return session;
    }
    this.setState('connecting');
    const providerSessionId = await this.realtimeProvider.createSession(options);
    const id = randomUUID();
    const session: VoiceSessionInfo = { id, state: 'listening', createdAt: Date.now(), provider: providerSessionId };
    this.sessions.set(id, session);

    // If the provider is an EventEmitter-like object, attach listeners to
    // forward provider events into the VoiceEngineService event stream.
    try {
      const providerAny = this.realtimeProvider as any
      const listeners: (() => void)[] = []
      if (providerAny && typeof providerAny.on === 'function') {
        const onPartial = (provId: string, text: string) => {
          if (provId !== providerSessionId) return
          this.emit('speech.partial', id, text)
        }
        const onFinal = (provId: string, text: string) => {
          if (provId !== providerSessionId) return
          this.emit('speech.final', id, text)
        }
        const onResponseStarted = (provId: string): void => { if (provId !== providerSessionId) return; this.emit('response.started', id); }
        const onResponseTextDelta = (provId: string, delta: string): void => { if (provId !== providerSessionId) return; this.emit('response.text.delta', id, delta); }
        const onResponseTextCompleted = (provId: string, text: string): void => { if (provId !== providerSessionId) return; this.emit('response.text.completed', id, text); }
        const onResponseAudio = (provId: string, audio: Buffer): void => { if (provId !== providerSessionId) return; this.emit('response.audio', id, audio); }
        const onResponseEnded = (provId: string): void => { if (provId !== providerSessionId) return; this.emit('response.ended', id); }

        providerAny.on('speech.partial', onPartial)
        providerAny.on('speech.final', onFinal)
        providerAny.on('response.started', onResponseStarted)
        providerAny.on('response.text.delta', onResponseTextDelta)
        providerAny.on('response.text.completed', onResponseTextCompleted)
        providerAny.on('response.audio', onResponseAudio)
        providerAny.on('response.ended', onResponseEnded)

        listeners.push(() => providerAny.off('speech.partial', onPartial))
        listeners.push(() => providerAny.off('speech.final', onFinal))
        listeners.push(() => providerAny.off('response.started', onResponseStarted))
        listeners.push(() => providerAny.off('response.text.delta', onResponseTextDelta))
        listeners.push(() => providerAny.off('response.text.completed', onResponseTextCompleted))
        listeners.push(() => providerAny.off('response.audio', onResponseAudio))
        listeners.push(() => providerAny.off('response.ended', onResponseEnded))
      }
      if (listeners.length) this.providerListeners.set(id, listeners)
    } catch (err) {
      // non-fatal if provider does not support events
    }

    this.setState('listening');
    this.emit('session.created', session);
    return session;
  }

  async sendAudio(sessionId: string, chunk: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new VoiceEngineError('session_not_found', 'Session not found');
    if (!this.realtimeProvider || !this.realtimeProvider.configured) {
      // no-op: replay back to transcription if available
      if (this.speechProvider && this.speechProvider.configured) {
        // fire and forget: client may call transcribe explicitly
        this.emit('audio.received', sessionId, chunk.length);
      }
      return;
    }
    try {
      await this.realtimeProvider.sendAudio(session.provider!, chunk);
      this.emit('audio.sent', sessionId, chunk.length);
    } catch (err) {
      this.emit('session.error', sessionId, err);
      throw new VoiceEngineError('realtime_send_failed', (err instanceof Error) ? err.message : String(err));
    }
  }

  async interrupt(sessionId?: string): Promise<void> {
    // Stop any TTS playback and transition to interrupted state
    this.setState('interrupted');
    if (sessionId) this.emit('session.interrupted', sessionId);
    // Provider-specific interruption
    try {
      if (sessionId && this.realtimeProvider && typeof (this.realtimeProvider as any).interrupt === 'function') {
        const session = this.sessions.get(sessionId)
        if (session && session.provider) {
          await (this.realtimeProvider as any).interrupt(session.provider)
        }
      }
    } catch (err) {
      // ignore provider interruption errors
    }
  }

  async sendProviderEvent(sessionId: string, event: string, payload?: unknown): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new VoiceEngineError('session_not_found', 'Session not found');
    if (!this.realtimeProvider || !this.realtimeProvider.configured) return;
    if (typeof (this.realtimeProvider as any).sendEvent === 'function') {
      try {
        await (this.realtimeProvider as any).sendEvent(session.provider, event, payload)
      } catch (err) {
        this.emit('session.error', sessionId, err)
      }
    }
  }

  async endVoiceSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (this.realtimeProvider && this.realtimeProvider.configured && session.provider) {
      try { await this.realtimeProvider.closeSession(session.provider); } catch (err) { /* ignore */ }
    }

    // Remove provider listeners for this session
    const listeners = this.providerListeners.get(sessionId)
    if (listeners) {
      listeners.forEach(fn => { try { fn() } catch {} })
      this.providerListeners.delete(sessionId)
    }

    this.sessions.delete(sessionId);
    this.emit('session.ended', sessionId);
    if (this.sessions.size === 0) this.setState('idle');
  }

  async synthesize(text: string): Promise<Buffer> {
    if (!this.ttsProvider || !this.ttsProvider.configured) throw new VoiceEngineError('no_tts', 'No TTS provider configured.');
    this.setState('speaking');
    this.emit('tts.started', text);
    try {
      const audio = await this.ttsProvider.synthesize(text);
      this.emit('tts.completed', audio.length);
      this.setState('listening');
      return audio;
    } catch (err) {
      this.emit('tts.failed', err);
      this.setState('error');
      throw new VoiceEngineError('tts_failed', (err instanceof Error) ? err.message : String(err));
    }
  }

  listSessions(): VoiceSessionInfo[] { return Array.from(this.sessions.values()); }
}
