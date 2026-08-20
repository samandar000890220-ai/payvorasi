const API = (path: string) => `/api${path}`

async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  let payload: (T & { message?: string }) | undefined
  try { payload = await response.json() as T & { message?: string } } catch { /* non-JSON */ }
  if (!response.ok) {
    const message = payload?.message ?? (
      response.status === 429 ? 'You are sending requests too quickly. Please wait a moment and retry.' :
      response.status >= 500 ? 'The service hit a problem. Please retry.' : fallback)
    throw new Error(message)
  }
  if (payload === undefined) throw new Error(fallback)
  return payload
}

export type VoiceSummary = {
  id: string
  name: string
  description: string | null
  category: string
  favorite: boolean
  referenceText: string | null
  avatarUrl: string | null
  lastUsedAt: string | null
  createdAt: string
}

export type GenerationRecord = {
  id: string
  voiceId: string | null
  voiceName: string
  title: string
  text: string
  settings: Record<string, unknown>
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  audioAvailable: boolean
  durationSeconds: number | null
  error: string | null
  favorite: boolean
  createdAt: string
  completedAt: string | null
}

export type Capabilities = {
  engine: string
  configured: boolean
  reachable: boolean
  healthDetail: string
  supportedControls: string[]
  unsupportedControls: { name: string; reason: string }[]
  pauses: { supported: boolean; mechanism: string }
  outputFormats: string[]
  sampleRates: number[]
  maxTextLength: number
}

export type TagDefinition = {
  name: string
  type: string
  aliases: string[]
  description: string
  strategy: string
  spoken: boolean
  separateAudioEvent: boolean
  postProcess: boolean
  supported: boolean
  unsupportedReason?: string
}

export const getCapabilities = async (): Promise<Capabilities> =>
  jsonOrThrow<Capabilities>(await fetch(API('/voice/capabilities')), 'Unable to load engine capabilities.')

export const getVoiceTags = async (): Promise<TagDefinition[]> =>
  (await jsonOrThrow<{ tags: TagDefinition[] }>(await fetch(API('/voice/tags')), 'Unable to load voice tags.')).tags

export const parseVoiceText = async (text: string) =>
  jsonOrThrow<{ events?: unknown[] }>(await fetch(API('/voice/parse'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  }), 'Tag validation failed.')

// ── Voices ──────────────────────────────────────────────────────────────────
export const listVoices = async (): Promise<VoiceSummary[]> =>
  (await jsonOrThrow<{ voices: VoiceSummary[] }>(await fetch(API('/voices')), 'Unable to load saved voices.')).voices

export const uploadVoice = async (file: File | Blob, name: string, referenceText?: string): Promise<VoiceSummary> =>
  jsonOrThrow<VoiceSummary>(await fetch(API('/voices'), {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-voice-name': name,
      ...(referenceText ? { 'x-reference-text': referenceText } : {}),
    },
    body: file,
  }), 'Voice upload failed.')

export const updateVoice = async (id: string, patch: { name?: string; description?: string; favorite?: boolean; category?: string }): Promise<VoiceSummary> =>
  jsonOrThrow<VoiceSummary>(await fetch(API(`/voices/${encodeURIComponent(id)}`), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  }), 'Voice update failed.')

export const duplicateVoice = async (id: string): Promise<VoiceSummary> =>
  jsonOrThrow<VoiceSummary>(await fetch(API(`/voices/${encodeURIComponent(id)}/duplicate`), { method: 'POST' }), 'Voice duplication failed.')

export const deleteVoice = async (id: string): Promise<void> => {
  const response = await fetch(API(`/voices/${encodeURIComponent(id)}`), { method: 'DELETE' })
  if (!response.ok) throw new Error('Voice deletion failed.')
}

export const voiceAudioUrl = (id: string) => API(`/voices/${encodeURIComponent(id)}/audio`)

// ── Generation ──────────────────────────────────────────────────────────────
export const generateVoice = async (voiceId: string, text: string, settings?: Record<string, unknown>, title?: string): Promise<string> => {
  const payload = await jsonOrThrow<{ generationId?: string }>(await fetch(API(`/voices/${encodeURIComponent(voiceId)}/generate`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, settings, title }),
  }), 'Generation request failed.')
  if (!payload.generationId) throw new Error('Generation request failed.')
  return payload.generationId
}

export const previewVoice = async (voiceId: string, text?: string): Promise<string> => {
  const payload = await jsonOrThrow<{ generationId?: string }>(await fetch(API(`/voices/${encodeURIComponent(voiceId)}/preview`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  }), 'Preview request failed.')
  if (!payload.generationId) throw new Error('Preview request failed.')
  return payload.generationId
}

export const getGeneration = async (id: string): Promise<GenerationRecord> =>
  jsonOrThrow<GenerationRecord>(await fetch(API(`/generation/${encodeURIComponent(id)}`)), 'Unable to read generation status.')

export const cancelGeneration = async (id: string): Promise<GenerationRecord> =>
  jsonOrThrow<GenerationRecord>(await fetch(API(`/generation/${encodeURIComponent(id)}/cancel`), { method: 'POST' }), 'Unable to cancel generation.')

export const generationAudioUrl = (id: string, options?: { format?: string; sampleRate?: number; download?: boolean }) => {
  const params = new URLSearchParams()
  if (options?.format) params.set('format', options.format)
  if (options?.sampleRate) params.set('sampleRate', String(options.sampleRate))
  if (options?.download) params.set('download', '1')
  const query = params.toString()
  return API(`/generation/${encodeURIComponent(id)}/audio${query ? `?${query}` : ''}`)
}

/** Poll a generation until it reaches a terminal state. */
export async function waitForGeneration(id: string, onProgress?: (g: GenerationRecord) => void, signal?: AbortSignal): Promise<GenerationRecord> {
  for (;;) {
    if (signal?.aborted) throw new Error('Cancelled.')
    const record = await getGeneration(id)
    onProgress?.(record)
    if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') return record
    await new Promise(resolve => setTimeout(resolve, 1200))
  }
}

// ── History ─────────────────────────────────────────────────────────────────
export const listHistory = async (): Promise<GenerationRecord[]> =>
  (await jsonOrThrow<{ items: GenerationRecord[] }>(await fetch(API('/history')), 'Unable to load history.')).items

export const updateHistoryItem = async (id: string, patch: { favorite?: boolean; title?: string }): Promise<GenerationRecord> =>
  jsonOrThrow<GenerationRecord>(await fetch(API(`/history/${encodeURIComponent(id)}`), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  }), 'History update failed.')

export const deleteHistoryItem = async (id: string): Promise<void> => {
  const response = await fetch(API(`/history/${encodeURIComponent(id)}`), { method: 'DELETE' })
  if (!response.ok) throw new Error('History deletion failed.')
}

// ── Settings ────────────────────────────────────────────────────────────────
export const getSettings = async (): Promise<Record<string, unknown>> =>
  (await jsonOrThrow<{ settings: Record<string, unknown> }>(await fetch(API('/settings')), 'Unable to load settings.')).settings

export const saveSettings = async (settings: Record<string, unknown>): Promise<void> => {
  await jsonOrThrow(await fetch(API('/settings'), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }),
  }), 'Unable to save settings.')
}

export const transcribeAudio = async (file: File | Blob): Promise<string> =>
  (await jsonOrThrow<{ text: string }>(await fetch(API('/audio/transcribe'), {
    method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
  }), 'Transcription is unavailable.')).text
