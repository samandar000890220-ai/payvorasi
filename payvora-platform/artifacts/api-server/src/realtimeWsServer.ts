import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { VoiceEngineService } from './voice/engine';

/**
 * Realtime WebSocket message contract types (JSON control messages).
 */
export type RealtimeClientMessage =
  | { type: 'session.start'; options?: Record<string, unknown> }
  | { type: 'speech.start' }
  | { type: 'speech.end' }
  | { type: 'interrupt' }
  | { type: 'session.end' }
  | { type: 'ping' }

export type RealtimeServerMessage =
  | { type: 'session.created'; sessionId: string }
  | { type: 'session.ended'; sessionId: string }
  | { type: 'speech.partial'; text: string }
  | { type: 'speech.final'; text: string }
  | { type: 'response.started' }
  | { type: 'response.text.delta'; delta: string }
  | { type: 'response.text.completed'; text: string }
  | { type: 'response.audio'; data: string }
  | { type: 'response.ended' }
  | { type: 'error'; code?: string; message: string }

/**
 * Attach a realtime WebSocket server at /api/realtime/voice.
 * The server will bridge browser binary audio frames and control messages
 * to the VoiceEngineService. A provider adapter can be registered inside
 * VoiceEngineService to forward to an upstream realtime provider.
 */
export async function attachRealtimeWsServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/api/realtime/voice' });

  // Provider selection (server-side only)
  const providerKind = (process.env['REALTIME_PROVIDER'] ?? '').toLowerCase()
  let providerInstance: any = null
  if (providerKind === 'loopback') {
    const mod = await import('./voice/loopbackProvider')
    const LoopbackRealtimeProvider = mod.LoopbackRealtimeProvider
    providerInstance = new LoopbackRealtimeProvider()
  }

  // Shared voice engine instance (server-side orchestration)
  const engine = new VoiceEngineService({ realtime: providerInstance ?? undefined });

  wss.on('connection', (ws: any, _req: any) => {
    let sessionId: string | null = null

    function sendJson(msg: RealtimeServerMessage) {
      try { ws.send(JSON.stringify(msg)) } catch {}
    }

    // per-connection engine handlers that forward server events to this websocket
    const onSpeechPartial = (sid: string, text: string) => { if (sid === sessionId) sendJson({ type: 'speech.partial', text }) }
    const onSpeechFinal = (sid: string, text: string) => { if (sid === sessionId) sendJson({ type: 'speech.final', text }) }
    const onResponseStarted = (sid: string) => { if (sid === sessionId) sendJson({ type: 'response.started' }) }
    const onResponseTextDelta = (sid: string, delta: string) => { if (sid === sessionId) sendJson({ type: 'response.text.delta', delta }) }
    const onResponseTextCompleted = (sid: string, text: string) => { if (sid === sessionId) sendJson({ type: 'response.text.completed', text }) }
    const onResponseAudio = (sid: string, audio: Buffer) => {
      if (sid !== sessionId) return
      try {
        // send base64-encoded audio payload as response.audio
        const b64 = audio.toString('base64')
        sendJson({ type: 'response.audio', data: b64 })
      } catch (err) { /* ignore */ }
    }
    const onResponseEnded = (sid: string) => { if (sid === sessionId) sendJson({ type: 'response.ended' }) }

    engine.on('speech.partial', onSpeechPartial as any)
    engine.on('speech.final', onSpeechFinal as any)
    engine.on('response.started', onResponseStarted as any)
    engine.on('response.text.delta', onResponseTextDelta as any)
    engine.on('response.text.completed', onResponseTextCompleted as any)
    engine.on('response.audio', onResponseAudio as any)
    engine.on('response.ended', onResponseEnded as any)

    // Honest configuration check: if no provider is configured, notify client
    const providerConfigured = !!providerInstance
    if (!providerConfigured) {
      sendJson({ type: 'error', code: 'provider_not_configured', message: 'Realtime provider not configured on server. Set REALTIME_PROVIDER environment variable to "loopback" or a configured provider.' })
      try { ws.close(1011, 'provider_not_configured') } catch {}
      // cleanup engine listeners
      engine.off('speech.partial', onSpeechPartial as any)
      engine.off('speech.final', onSpeechFinal as any)
      engine.off('response.started', onResponseStarted as any)
      engine.off('response.text.delta', onResponseTextDelta as any)
      engine.off('response.text.completed', onResponseTextCompleted as any)
      engine.off('response.audio', onResponseAudio as any)
      engine.off('response.ended', onResponseEnded as any)
      return
    }

    ws.on('message', async (data: any, isBinary: boolean) => {
      try {
        if (!isBinary) {
          let payload: RealtimeClientMessage
          try { payload = JSON.parse(data.toString()) as RealtimeClientMessage } catch (err) { sendJson({ type: 'error', message: 'Malformed JSON' }); return }
          switch (payload.type) {
            case 'session.start': {
              try {
                const info = await engine.startVoiceSession(payload.options)
                sessionId = info.id
                sendJson({ type: 'session.created', sessionId: info.id })
              } catch (err) {
                sendJson({ type: 'error', code: 'session_start_failed', message: (err as Error).message || 'Session start failed' })
              }
              break
            }
            case 'speech.start': {
              // forward VAD event to provider
              if (sessionId) await engine.sendProviderEvent(sessionId, 'speech.start')
              break
            }
            case 'speech.end': {
              // forward VAD event to provider
              if (sessionId) await engine.sendProviderEvent(sessionId, 'speech.end')
              break
            }
            case 'interrupt': {
              try { await engine.interrupt(sessionId ?? undefined) } catch (err) {}
              if (sessionId) await engine.sendProviderEvent(sessionId, 'interrupt')
              break
            }
            case 'session.end': {
              if (sessionId) await engine.endVoiceSession(sessionId)
              break
            }
            case 'ping': {
              // no-op reply for liveness
              break
            }
          }
        } else if (data instanceof Buffer || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          // Binary frames are audio frames (PCM16) forwarded to engine
          if (!sessionId) { sendJson({ type: 'error', message: 'No active session' }); return }
          let buf: Buffer
          if (data instanceof Buffer) buf = data
          else if (ArrayBuffer.isView(data)) buf = Buffer.from((data as any).buffer, (data as any).byteOffset, (data as any).byteLength)
          else buf = Buffer.from(data as ArrayBuffer)
          try {
            await engine.sendAudio(sessionId, buf)
          } catch (err) {
            sendJson({ type: 'error', code: 'audio_forward_failed', message: (err as Error).message || 'Audio forward failed' })
          }
        }
      } catch (err) {
        // catch-all for per-message errors
        try { ws.send(JSON.stringify({ type: 'error', message: (err as Error).message || 'Server error' })) } catch {}
      }
    })

    ws.on('close', () => {
      // end session if active
      if (sessionId) {
        engine.endVoiceSession(sessionId).catch(() => {})
      }
      // remove the same listeners we registered above
      engine.off('speech.partial', onSpeechPartial as any)
      engine.off('speech.final', onSpeechFinal as any)
      engine.off('response.started', onResponseStarted as any)
      engine.off('response.text.delta', onResponseTextDelta as any)
      engine.off('response.text.completed', onResponseTextCompleted as any)
      engine.off('response.audio', onResponseAudio as any)
      engine.off('response.ended', onResponseEnded as any)
    })
  })

  return wss;
}
