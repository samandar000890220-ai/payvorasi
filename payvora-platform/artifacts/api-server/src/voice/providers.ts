import type { VoiceProviderHealth } from './provider';

export interface SpeechToTextProvider {
  configured: boolean;
  health?(): Promise<VoiceProviderHealth>;
  /** Transcribe normalized WAV/PCM audio buffer and return transcript text */
  transcribe(audio: Buffer): Promise<string>;
}

export interface RealtimeVoiceProvider {
  configured: boolean;
  health?(): Promise<VoiceProviderHealth>;
  /** Establish a realtime session. Returns a session ID or object provided by the provider */
  createSession(options?: Record<string, unknown>): Promise<string>;
  /** Send audio chunks to the session. */
  sendAudio(sessionId: string, chunk: Buffer): Promise<void>;
  /** Send a high-level event/command to the provider (e.g., speech.start, speech.end, interrupt) */
  sendEvent?(sessionId: string, event: string, payload?: unknown): Promise<void>;
  /** Interrupt processing */
  interrupt?(sessionId: string): Promise<void>;
  /** Close the session */
  closeSession(sessionId: string): Promise<void>;
}

export interface TextToSpeechProvider {
  configured: boolean;
  health?(): Promise<VoiceProviderHealth>;
  /** Synthesize speech from text and return audio bytes (wav) */
  synthesize(text: string, opts?: Record<string, unknown>): Promise<Buffer>;
}
