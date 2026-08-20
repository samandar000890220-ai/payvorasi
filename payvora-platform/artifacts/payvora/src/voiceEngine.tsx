import { useEffect, useRef, useState } from 'react';

// Realtime-focused UI-independent voice engine hook.
// Implements the authoritative WebSocket, AudioWorklet, PCM16 transport, and
// analyser nodes used by both Voice Studio and the home composer.

export type VoiceConnectionState =
  | 'idle'
  | 'connecting'
  | 'requesting_permission'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error'

export type UseVoiceEngineResult = {
  // State
  state: VoiceConnectionState
  error: string | null

  // Transcription
  partialTranscript: string
  finalTranscript: string

  // Flags
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  isThinking: boolean
  isInterrupted: boolean

  // Audio analysers for waveform
  inputAnalyser: AnalyserNode | null
  outputAnalyser: AnalyserNode | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  startVoiceSession: () => Promise<void>
  endVoiceSession: () => Promise<void>
  interrupt: () => Promise<void>
  mute: () => void
  unmute: () => void
  reset: () => void
}

// Internal hook implementation. Consumers should use the context-backed hook
// exported from src/voiceEngineContext.tsx which provides a single authoritative
// engine instance. This function implements the actual engine logic and is
// used by the VoiceEngineProvider.
export function useVoiceEngineInternal(): UseVoiceEngineResult {
  // New realtime-focused implementation replaced the old file-upload flow.
  // Keep the existing public shape but implement a genuine streaming transport
  // using WebSocket and the Web Audio API. If the server lacks a realtime
  // provider, the server will return a clear configuration error.

  const [state, setState] = useState<VoiceConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const connectionPromiseRef = useRef<Promise<void> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const inputAnalyserRef = useRef<AnalyserNode | null>(null)
  const outputAnalyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const outputSourceRef = useRef<AudioBufferSourceNode | null>(null)

  const [partialTranscript, setPartialTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isInterrupted, setIsInterrupted] = useState(false)

  // VAD helpers
  const vadStateRef = useRef<'silence' | 'speech'>('silence')
  const silenceStartRef = useRef<number | null>(null)

  // convert floats to 16-bit PCM ArrayBuffer
  function floatTo16BitPCM(float32Array: Float32Array) {
    const l = float32Array.length
    const buf = new ArrayBuffer(l * 2)
    const view = new DataView(buf)
    let offset = 0
    for (let i = 0; i < l; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buf
  }

  function ensureAudioContext() {
    if (audioCtxRef.current) return audioCtxRef.current
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as any
    const audioCtx = new Ctx()
    audioCtxRef.current = audioCtx
    return audioCtx
  }

  function getInputAnalyser() {
    return inputAnalyserRef.current
  }

  function getOutputAnalyser() {
    if (!outputAnalyserRef.current) {
      const audioCtx = ensureAudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      outputAnalyserRef.current = analyser
    }
    return outputAnalyserRef.current
  }

  function handleServerMessage(payload: any) {
    if (!payload || typeof payload !== 'object') return
    switch (payload.type) {
      case 'error':
        setError(payload.message ?? 'Realtime provider error')
        setState('error')
        break
      case 'session.created':
        break
      case 'speech.partial':
        setPartialTranscript(payload.text ?? '')
        break
      case 'speech.final':
        setFinalTranscript(prev => prev ? prev + '\n' + payload.text : payload.text)
        setPartialTranscript('')
        break
      case 'response.started':
        setIsThinking(false)
        setIsSpeaking(true)
        setState('speaking')
        break
      case 'response.ended':
        setIsSpeaking(false)
        setState('listening')
        break
      case 'response.audio':
        if (payload.data) playRemoteAudioBase64(payload.data)
        break
      default:
        break
    }
  }

  async function playRemoteAudioBase64(b64: string) {
    try {
      const audioCtx = ensureAudioContext()
      const bytes = atob(b64)
      const buf = new ArrayBuffer(bytes.length)
      const view = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i)
      const audioBuffer = await audioCtx.decodeAudioData(buf)
      const src = audioCtx.createBufferSource()
      src.buffer = audioBuffer
      const analyser = getOutputAnalyser()
       if (!analyser) return
      src.connect(analyser)
      analyser.connect(audioCtx.destination)
      src.start()
      outputSourceRef.current = src
    } catch (err) {
      console.warn('Failed to play remote audio', err)
    }
  }

  async function connect() {
    if (connectionPromiseRef.current) return connectionPromiseRef.current
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState('connecting')
    setError(null)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${wsProtocol}://${window.location.host}/api/realtime/voice`
    const promise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url)
      let settled = false
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        reject(error)
      }

      ws.addEventListener('open', () => {
        setIsConnected(true)
        try {
          ws.send(JSON.stringify({ type: 'session.start' }))
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Could not start realtime voice session.'))
        }
      })

      ws.addEventListener('message', (ev) => {
        try {
          if (typeof ev.data !== 'string') return
          const payload = JSON.parse(ev.data)
          if (payload?.type === 'error') {
            handleServerMessage(payload)
            fail(new Error(payload.message ?? 'Realtime provider error'))
            return
          }
          if (payload?.type === 'session.created') {
            handleServerMessage(payload)
            if (!settled) {
              settled = true
              resolve()
            }
            return
          }
          handleServerMessage(payload)
        } catch (error) {
          console.warn('Failed to parse realtime message', error)
        }
      })

      ws.addEventListener('close', () => {
        wsRef.current = null
        setIsConnected(false)
        if (!settled) fail(new Error('Realtime voice connection closed before the session started.'))
        setState(current => current === 'error' ? current : 'idle')
      })

      ws.addEventListener('error', () => {
        const error = new Error('Realtime connection error')
        setError(error.message)
        setState('error')
        fail(error)
        try { ws.close() } catch {}
      })
    })
    connectionPromiseRef.current = promise
    try {
      await promise
    } finally {
      if (connectionPromiseRef.current === promise) connectionPromiseRef.current = null
    }
  }

  async function startVoiceSession() {
    setError(null)
    setState('requesting_permission')
    setPartialTranscript('')
    setFinalTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      localStreamRef.current = stream
      if (!wsRef.current) await connect()
      const audioCtx = ensureAudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      const inputAnalyser = audioCtx.createAnalyser()
      inputAnalyser.fftSize = 2048
      source.connect(inputAnalyser)
      inputAnalyserRef.current = inputAnalyser

      // Primary capture path: AudioWorklet
      try {
        // Load the worklet module (bundlers should make this available). Use import.meta.url so bundlers resolve the path.
        await audioCtx.audioWorklet.addModule(new URL('./audio/voice-capture.worklet.ts', import.meta.url).toString())
        const workletNode = new AudioWorkletNode(audioCtx, 'payvora-voice-capture', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 })
        workletNodeRef.current = workletNode

        // Connect source -> analyser (for waveform) and source -> worklet
        source.connect(inputAnalyser)
        source.connect(workletNode)

        workletNode.port.onmessage = (ev) => {
          const msg = ev.data
          if (!msg || !wsRef.current) return
          try {
            if (msg.type === 'audio' && msg.data instanceof ArrayBuffer) {
              // Send raw PCM16 binary frames directly over the WebSocket
              if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(msg.data)
              }
            } else if (msg.type === 'speech.start') {
              try { wsRef.current.send(JSON.stringify({ type: 'speech.start' })) } catch {}
            } else if (msg.type === 'speech.end') {
              try { wsRef.current.send(JSON.stringify({ type: 'speech.end' })) } catch {}
            }
          } catch (err) {
            // ignore
          }
        }
      } catch (err) {
        throw new Error('AudioWorklet unavailable or failed to load. Realtime voice requires AudioWorklet support.')
      }

      setState('listening')
      setIsConnected(true)
    } catch (err) {
      try { await endVoiceSession() } catch {}
      setError(err instanceof Error ? err.message : 'Realtime voice session failed.')
      setState('error')
      throw err
    }
  }

  async function endVoiceSession() {
    try { workletNodeRef.current?.port.close() } catch {}
    try { workletNodeRef.current?.disconnect() } catch {}
    try { processorRef.current?.disconnect() } catch {}
    try { sourceRef.current?.disconnect() } catch {}
    workletNodeRef.current = null
    processorRef.current = null
    sourceRef.current = null
    inputAnalyserRef.current = null
    outputAnalyserRef.current = null
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
      audioCtxRef.current = null
    }
    try { wsRef.current?.send(JSON.stringify({ type: 'session.end' })) } catch {}
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setIsConnected(false)
    setState('idle')
  }

  async function disconnect() { await endVoiceSession() }

  async function interrupt() {
    try { wsRef.current?.send(JSON.stringify({ type: 'interrupt' })) } catch {}
    setIsInterrupted(true)
    try { outputSourceRef.current?.stop() } catch {}
    setTimeout(() => setIsInterrupted(false), 200)
  }

  function mute() { if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false) }
  function unmute() { if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = true) }

  function reset() {
    try { endVoiceSession() } catch {}
    setPartialTranscript('')
    setFinalTranscript('')
    setError(null)
    setIsSpeaking(false)
    setIsThinking(false)
    setIsInterrupted(false)
    setState('idle')
  }

  useEffect(() => {
    setIsSpeaking(state === 'speaking')
    setIsThinking(state === 'thinking')
  }, [state])

  // Expose analyser nodes for waveform component to use
  const inputAnalyser = inputAnalyserRef.current
  const outputAnalyser = outputAnalyserRef.current

  return {
    state,
    error,
    isConnected,
    isListening: state === 'listening',
    isSpeaking: state === 'speaking' || isSpeaking,
    isThinking: state === 'thinking' || isThinking,
    isInterrupted,
    partialTranscript,
    finalTranscript,
    inputAnalyser,
    outputAnalyser,
    connect,
    disconnect,
    startVoiceSession,
    endVoiceSession,
    interrupt,
    mute,
    unmute,
    reset,
  } as UseVoiceEngineResult;
}
