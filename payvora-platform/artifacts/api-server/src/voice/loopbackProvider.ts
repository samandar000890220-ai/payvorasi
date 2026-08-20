import { EventEmitter } from 'events';
import { randomUUID } from "node:crypto";
import type { RealtimeVoiceProvider } from './providers';

/**
 * Loopback RealtimeVoiceProvider for local development and testing.
 *
 * Behaviour: creates an in-memory session and emits deterministic events
 * (speech.partial, speech.final, response.*) to simulate upstream provider
 * behaviour. NEVER use in production. No credentials required.
 */
export class LoopbackRealtimeProvider extends EventEmitter implements RealtimeVoiceProvider {
  configured = true

  private sessions: Map<string, { createdAt: number; timers: NodeJS.Timeout[] }> = new Map()

  async createSession(_options?: Record<string, unknown>): Promise<string> {
    const id = randomUUID()
    this.sessions.set(id, { createdAt: Date.now(), timers: [] })

    // Emit nothing immediately — caller (engine) will receive sessions and
    // may forward client audio/events. We also schedule a gentle demo sequence
    // that only runs if the session receives a speech.end event; otherwise it
    // stays quiet.

    return id
  }

  async sendAudio(sessionId: string, _chunk: Buffer): Promise<void> {
    // Loopback provider simply notes receipt. Do not emit heavy events on each chunk.
    // For deterministic behaviour, we won't auto-generate transcripts from audio.
    if (!this.sessions.has(sessionId)) throw new Error('session_not_found')
    return
  }

  async sendEvent(sessionId: string, event: string, payload?: unknown): Promise<void> {
    // Accept notifications such as speech.start / speech.end / interrupt
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error('session_not_found')

    if (event === 'speech.end') {
      // Deterministic demo: after speech ended, emit a small partial / final transcript
      // and a brief response text and audio.
      const partialTimer = setTimeout(() => this.emit('speech.partial', sessionId, 'This is a loopback partial.'), 50)
      const finalTimer = setTimeout(() => this.emit('speech.final', sessionId, 'This is a loopback final.'), 250)
      const responseStart = setTimeout(() => this.emit('response.started', sessionId), 300)
      const responseTextDelta = setTimeout(() => this.emit('response.text.delta', sessionId, 'Loopback reply (partial) '), 350)
      const responseTextCompleted = setTimeout(() => this.emit('response.text.completed', sessionId, 'Loopback reply completed.'), 550)

      // For response.audio, emit a tiny generated sine wave PCM16 buffer as a demo
      const responseAudioTimer = setTimeout(() => {
        const sampleRate = 16000
        const durationSec = 0.3
        const samples = Math.floor(sampleRate * durationSec)
        const buf = Buffer.alloc(samples * 2)
        const freq = 440
        for (let i = 0; i < samples; i++) {
          const t = i / sampleRate
          const sVal = Math.round(Math.sin(2 * Math.PI * freq * t) * 0.3 * 0x7fff)
          buf.writeInt16LE(sVal, i * 2)
        }
        this.emit('response.audio', sessionId, buf)
      }, 500)

      const responseEnded = setTimeout(() => this.emit('response.ended', sessionId), 900)

      s.timers.push(partialTimer, finalTimer, responseStart, responseTextDelta, responseTextCompleted, responseAudioTimer, responseEnded)
    } else if (event === 'interrupt') {
      // Clear any pending timers and emit response.ended
      s.timers.forEach(t => clearTimeout(t))
      s.timers = []
      this.emit('response.ended', sessionId)
    }
  }

  async interrupt(sessionId: string): Promise<void> {
    await this.sendEvent(sessionId, 'interrupt')
  }

  async closeSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId)
    if (s) {
      s.timers.forEach(t => clearTimeout(t))
      this.sessions.delete(sessionId)
    }
    return
  }
}
