import { useEffect, useState } from 'react'

/**
 * Singleton audio manager: one HTMLAudioElement for the whole app so only one
 * clip plays at a time. Components subscribe to know which track is active.
 */
export type AudioTrackState = {
  trackId: string | null
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error'
  currentTime: number
  duration: number
  error?: string
}

type Listener = (state: AudioTrackState) => void

class AudioManager {
  private audio: HTMLAudioElement | null = null
  private state: AudioTrackState = { trackId: null, status: 'idle', currentTime: 0, duration: 0 }
  private listeners = new Set<Listener>()

  private ensure(): HTMLAudioElement {
    if (!this.audio) {
      const el = new Audio()
      el.preload = 'auto'
      el.addEventListener('timeupdate', () => this.patch({ currentTime: el.currentTime }))
      el.addEventListener('durationchange', () => this.patch({ duration: Number.isFinite(el.duration) ? el.duration : 0 }))
      el.addEventListener('playing', () => this.patch({ status: 'playing' }))
      el.addEventListener('pause', () => { if (this.state.status !== 'idle' && this.state.status !== 'error') this.patch({ status: el.ended ? 'idle' : 'paused' }) })
      el.addEventListener('ended', () => this.patch({ status: 'idle', currentTime: 0 }))
      el.addEventListener('error', () => this.patch({ status: 'error', error: 'Audio failed to load. It may have been deleted or the network dropped.' }))
      this.audio = el
    }
    return this.audio
  }

  private patch(partial: Partial<AudioTrackState>) {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach(fn => fn(this.state))
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.state)
    return () => this.listeners.delete(fn)
  }

  getState(): AudioTrackState {
    return this.state
  }

  /** Play a URL under a stable track id. Toggles pause/resume when the same track is active. */
  async toggle(trackId: string, url: string): Promise<void> {
    const el = this.ensure()
    if (this.state.trackId === trackId) {
      if (this.state.status === 'playing') { el.pause(); return }
      if (this.state.status === 'paused') { await el.play().catch(() => this.patch({ status: 'error', error: 'Playback was blocked.' })); return }
    }
    this.patch({ trackId, status: 'loading', currentTime: 0, duration: 0, error: undefined })
    el.src = url
    try {
      await el.play()
    } catch {
      this.patch({ status: 'error', error: 'Playback failed. Try again.' })
    }
  }

  seek(seconds: number) {
    const el = this.ensure()
    if (Number.isFinite(seconds)) el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds))
  }

  stop() {
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
    }
    this.patch({ trackId: null, status: 'idle', currentTime: 0, duration: 0 })
  }
}

export const audioManager = new AudioManager()

/** React hook: current audio state (re-renders on changes). */
export function useAudioState(): AudioTrackState {
  const [state, setState] = useState<AudioTrackState>(audioManager.getState())
  useEffect(() => audioManager.subscribe(setState), [])
  return state
}
