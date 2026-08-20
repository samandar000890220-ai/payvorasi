import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { C } from '../tokens'
import { PlayButton, WaveformIcon, Slider, Toggle, SelectDropdown, VoiceCardPlayButton, SearchBar, FilterPill, ConfirmDialog } from '../components/Shared'
import {
  listVoices, updateVoice, previewVoice, generateVoice, getGeneration, cancelGeneration,
  waitForGeneration, generationAudioUrl, listHistory, deleteHistoryItem,
  getSettings, saveSettings, getCapabilities,
  type VoiceSummary, type GenerationRecord, type Capabilities,
} from '../api'
import { audioManager, useAudioState } from '../audioManager'

// Deterministic avatar color per voice id (voices are user recordings — no stock photos)
const AVATAR_COLORS = ['#6441E0', '#0EA5E9', '#F97316', '#10B981', '#EC4899', '#8B5CF6']
const avatarColor = (id: string) => AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

type GenPhase = 'idle' | 'validating' | 'submitting' | 'processing' | 'success' | 'failed'

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return '--:--'
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d >= today) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d >= yesterday) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TextToSpeech({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [voiceFilter, setVoiceFilter] = useState('all')
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [text, setText] = useState('Welcome to Payvora AI Voice Studio. Create realistic, expressive speech in seconds. Perfect for videos, podcasts, presentations, and more.')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [voices, setVoices] = useState<VoiceSummary[]>([])
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [voicesError, setVoicesError] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  // Settings — speed & pitch are real F5-TTS controls; stability/similarity are not.
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [naturalPauses, setNaturalPauses] = useState(true)
  const [outputFormat, setOutputFormat] = useState('wav')
  const [sampleRate, setSampleRate] = useState('24000')
  const settingsLoaded = useRef(false)

  // Generation state machine
  const [genPhase, setGenPhase] = useState<GenPhase>('idle')
  const [genProgress, setGenProgress] = useState(0)
  const [genError, setGenError] = useState<string | null>(null)
  const [genResult, setGenResult] = useState<GenerationRecord | null>(null)
  const activeGenId = useRef<string | null>(null)

  // Preview state (voice card play buttons)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const previewCache = useRef<Map<string, string>>(new Map())

  const [recent, setRecent] = useState<GenerationRecord[]>([])
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GenerationRecord | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const audio = useAudioState()

  const refreshVoices = useCallback(async () => {
    try {
      setVoicesError(null)
      setVoices(await listVoices())
    } catch (error) {
      setVoicesError(error instanceof Error ? error.message : 'Unable to load voices.')
    } finally {
      setVoicesLoading(false)
    }
  }, [])

  const refreshRecent = useCallback(async () => {
    try { setRecent((await listHistory()).slice(0, 5)) } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    void refreshVoices()
    void refreshRecent()
    getCapabilities().then(setCapabilities).catch(() => undefined)
    getSettings().then(s => {
      if (typeof s.speed === 'number') setSpeed(s.speed)
      if (typeof s.pitch === 'number') setPitch(s.pitch)
      if (typeof s.naturalPauses === 'boolean') setNaturalPauses(s.naturalPauses)
      if (typeof s.outputFormat === 'string') setOutputFormat(s.outputFormat)
      if (typeof s.sampleRate === 'string' || typeof s.sampleRate === 'number') setSampleRate(String(s.sampleRate))
      settingsLoaded.current = true
    }).catch(() => { settingsLoaded.current = true })
  }, [refreshVoices, refreshRecent])

  // Persist settings (debounced) once initial load completed
  useEffect(() => {
    if (!settingsLoaded.current) return
    const handle = setTimeout(() => {
      void saveSettings({ speed, pitch, naturalPauses, outputFormat, sampleRate }).catch(() => undefined)
    }, 600)
    return () => clearTimeout(handle)
  }, [speed, pitch, naturalPauses, outputFormat, sampleRate])

  // Keep a valid selection as voices load/change
  useEffect(() => {
    if (voices.length === 0) { setSelectedVoice(null); return }
    if (!selectedVoice || !voices.some(v => v.id === selectedVoice)) setSelectedVoice(voices[0].id)
  }, [voices, selectedVoice])

  // Honor "Use voice" handoff from My Voices
  useEffect(() => {
    const stored = sessionStorage.getItem('payvora-use-voice')
    if (stored) { setSelectedVoice(stored); sessionStorage.removeItem('payvora-use-voice') }
  }, [])

  const filtered = useMemo(() => voices.filter(v =>
    (voiceFilter === 'all' || (voiceFilter === 'favorites' ? v.favorite : true)) &&
    v.name.toLowerCase().includes(search.toLowerCase())
  ), [voices, voiceFilter, search])

  const selected = voices.find(v => v.id === selectedVoice) ?? null

  // ── Text editor actions ──────────────────────────────────────────────────
  const handleImportFile = async (file: File) => {
    if (file.size > 1024 * 1024) { setNotice({ kind: 'error', text: 'File is too large — 1 MB maximum for text import.' }); return }
    if (!/\.(txt|md|text)$/i.test(file.name) && !file.type.startsWith('text/')) {
      setNotice({ kind: 'error', text: 'Unsupported file. Import a .txt or .md text file.' }); return
    }
    const content = (await file.text()).trim()
    if (!content) { setNotice({ kind: 'error', text: 'That file is empty.' }); return }
    setText(content.slice(0, 5000))
    setNotice({ kind: 'info', text: `Imported ${file.name}${content.length > 5000 ? ' (trimmed to 5,000 characters)' : ''}.` })
  }

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current
    if (!el) { setText(t => (t + snippet).length > 5000 ? t : t + snippet); return }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    if (text.length - (end - start) + snippet.length > 5000) { setNotice({ kind: 'error', text: 'Adding that would exceed the 5,000 character limit.' }); return }
    el.focus()
    el.setSelectionRange(start, end)
    // Prefer execCommand so the browser's native undo/redo stack records the insertion.
    let inserted = false
    try { inserted = document.execCommand('insertText', false, snippet) } catch { inserted = false }
    if (inserted) {
      // Sync React state from the DOM value execCommand produced.
      setText(el.value)
    } else {
      const next = text.slice(0, start) + snippet + text.slice(end)
      setText(next)
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + snippet.length, start + snippet.length) })
    }
  }

  // ── Preview playback ─────────────────────────────────────────────────────
  const handlePreview = async (voice: VoiceSummary) => {
    const trackId = `preview-${voice.id}`
    const cached = previewCache.current.get(voice.id)
    if (cached) { void audioManager.toggle(trackId, cached); return }
    if (previewLoading) return
    setPreviewLoading(voice.id)
    setNotice(null)
    try {
      const genId = await previewVoice(voice.id)
      const done = await waitForGeneration(genId)
      if (done.status !== 'completed') throw new Error(done.error ?? 'Preview generation failed.')
      const url = generationAudioUrl(genId)
      previewCache.current.set(voice.id, url)
      void audioManager.toggle(trackId, url)
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Preview failed.' })
    } finally {
      setPreviewLoading(null)
    }
  }

  const previewState = (voiceId: string): 'idle' | 'loading' | 'playing' | 'paused' => {
    if (previewLoading === voiceId) return 'loading'
    if (audio.trackId === `preview-${voiceId}`) {
      if (audio.status === 'playing') return 'playing'
      if (audio.status === 'loading') return 'loading'
      if (audio.status === 'paused') return 'paused'
    }
    return 'idle'
  }

  // ── Favorites ────────────────────────────────────────────────────────────
  const toggleFavorite = async (voice: VoiceSummary) => {
    setVoices(vs => vs.map(v => v.id === voice.id ? { ...v, favorite: !v.favorite } : v)) // optimistic
    try { await updateVoice(voice.id, { favorite: !voice.favorite }) }
    catch { setVoices(vs => vs.map(v => v.id === voice.id ? { ...v, favorite: voice.favorite } : v)); setNotice({ kind: 'error', text: 'Could not update favorite. Try again.' }) }
  }

  // ── Generation ───────────────────────────────────────────────────────────
  const applyNaturalPauses = (input: string) =>
    naturalPauses ? input.replace(/\n\s*\n/g, '\n[short pause]\n') : input

  const handleGenerate = async () => {
    if (genPhase === 'submitting' || genPhase === 'processing') return
    setGenError(null)
    setGenPhase('validating')
    if (!text.trim()) { setGenPhase('failed'); setGenError('Enter some text to generate.'); return }
    if (text.length > 5000) { setGenPhase('failed'); setGenError('Text must be 5,000 characters or fewer.'); return }
    if (!selected) { setGenPhase('failed'); setGenError('Select a voice first — clone one in the Voice Clone tab if you have none.'); return }
    try {
      setGenPhase('submitting')
      setGenProgress(0)
      const settings: Record<string, unknown> = {}
      if (speed !== 1) settings.speed = speed
      if (pitch !== 0) settings.pitch = pitch
      const id = await generateVoice(selected.id, applyNaturalPauses(text), settings)
      activeGenId.current = id
      setGenPhase('processing')
      const done = await waitForGeneration(id, g => setGenProgress(g.progress))
      if (activeGenId.current !== id) return
      if (done.status === 'completed') {
        setGenResult(done)
        setGenPhase('success')
        void refreshRecent()
      } else if (done.status === 'cancelled') {
        setGenPhase('idle')
      } else {
        setGenPhase('failed')
        setGenError(done.error ?? 'Generation failed.')
        void refreshRecent()
      }
    } catch (error) {
      setGenPhase('failed')
      setGenError(error instanceof Error ? error.message : 'Generation failed.')
    }
  }

  const handleCancelGeneration = async () => {
    const id = activeGenId.current
    if (!id) return
    try { await cancelGeneration(id) } catch { /* it may already be done */ }
    activeGenId.current = null
    setGenPhase('idle')
    setGenProgress(0)
  }

  const generating = genPhase === 'submitting' || genPhase === 'processing'

  // ── Recent generations actions ───────────────────────────────────────────
  const playHistoryItem = (item: GenerationRecord) => {
    if (item.status !== 'completed') { setNotice({ kind: 'error', text: item.error ?? 'That generation has no audio.' }); return }
    void audioManager.toggle(`history-${item.id}`, generationAudioUrl(item.id))
  }

  const downloadItem = (item: GenerationRecord) => {
    if (item.status !== 'completed') { setNotice({ kind: 'error', text: 'Only completed generations can be downloaded.' }); return }
    const a = document.createElement('a')
    a.href = generationAudioUrl(item.id, { format: outputFormat, sampleRate: Number(sampleRate), download: true })
    a.download = ''
    document.body.appendChild(a); a.click(); a.remove()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await deleteHistoryItem(deleteTarget.id)
      if (audio.trackId === `history-${deleteTarget.id}`) audioManager.stop()
      setRecent(rs => rs.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Delete failed.' })
    } finally {
      setDeleteBusy(false)
    }
  }

  const historyPlayState = (item: GenerationRecord): 'idle' | 'loading' | 'playing' | 'paused' => {
    if (audio.trackId === `history-${item.id}`) {
      if (audio.status === 'playing') return 'playing'
      if (audio.status === 'loading') return 'loading'
      if (audio.status === 'paused') return 'paused'
    }
    return 'idle'
  }

  const unavailable = (name: string) =>
    capabilities?.unsupportedControls.find(c => c.name === name)?.reason ?? `Not supported by the ${capabilities?.engine ?? 'current'} engine.`

  return (
    <div className="voice-studio-layout" style={{ display: 'flex', gap: 20, padding: '20px 24px 40px' }} onClick={() => menuFor && setMenuFor(null)}>
      {/* ── Left column ─────────────────────────────────────────────── */}
      <div className="voice-selection-column" style={{ flex: 1, minWidth: 0, containerType: 'inline-size', containerName: 'voice-column', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Text input */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Enter your text</h2>
            <div style={{ display: 'flex', gap: 20 }}>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.text,text/plain,text/markdown" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); e.target.value = '' }} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: C.textGray, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.black)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textGray)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import Text
              </button>
              <button onClick={() => setText('')} disabled={!text}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: text ? C.textGray : C.border, background: 'none', border: 'none', cursor: text ? 'pointer' : 'default', padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => { if (text) e.currentTarget.style.color = C.black }}
                onMouseLeave={e => { if (text) e.currentTarget.style.color = C.textGray }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Clear
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value.slice(0, 5000))}
            aria-label="Text to convert to speech"
            style={{ width: '100%', resize: 'none', fontSize: 14, color: C.black, outline: 'none', lineHeight: 1.6, border: 'none', minHeight: 96, fontFamily: 'inherit', background: 'transparent' }}
            rows={4}
            placeholder="Type or paste your text here..."
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${C.borderLight}`, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: text.length >= 5000 ? C.red : C.textGray }}>{text.length} / 5000</span>
            {notice && (
              <span role={notice.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: 12, color: notice.kind === 'error' ? C.red : C.accent }}>
                {notice.text}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {[
              { label: 'Add Pause', snippet: ' [pause] ', title: 'Insert a brief pause at the cursor', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg> },
              { label: 'Emphasis', snippet: ' [emphasis] ', title: 'Emphasize the next sentence', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
              { label: 'Slower', snippet: ' [slowly] ', title: 'Slow down the following speech', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              { label: 'Whisper', snippet: ' [whisper] ', title: unavailable('emotion'), unavailable: true, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
            ].map((b: { label: string; snippet: string; title: string; icon: React.ReactNode; unavailable?: boolean }) => (
              <button key={b.label} title={b.title} disabled={b.unavailable} onClick={() => insertAtCursor(b.snippet)}
                aria-disabled={b.unavailable}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: C.accent, background: C.accentLight, border: 'none', borderRadius: 20, padding: '6px 12px', cursor: b.unavailable ? 'not-allowed' : 'pointer', opacity: b.unavailable ? 0.5 : 1, transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!b.unavailable) e.currentTarget.style.background = '#EDE8FA' }}
                onMouseLeave={e => (e.currentTarget.style.background = C.accentLight)}>
                {b.icon}{b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Choose a voice */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 16px' }}>Choose a voice</h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all', 'All Voices'], ['favorites', 'Favorites'], ['my-voices', 'My Voices']].map(([id, label]) => (
                <FilterPill key={id} label={label} active={voiceFilter === id} onClick={() => setVoiceFilter(id)} />
              ))}
            </div>
            <SearchBar placeholder="Search voices..." value={search} onChange={setSearch} />
          </div>

          {voicesLoading ? (
            <p style={{ fontSize: 13, color: C.textGray, margin: 0 }}>Loading voices…</p>
          ) : voicesError ? (
            <div role="alert" style={{ fontSize: 13, color: C.red, display: 'flex', alignItems: 'center', gap: 12 }}>
              {voicesError}
              <button onClick={() => { setVoicesLoading(true); void refreshVoices() }} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: C.accentLight, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>Retry</button>
            </div>
          ) : voices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <p style={{ fontSize: 14, color: C.textGray, margin: '0 0 12px' }}>No voices yet. Clone your first voice from a short recording to start generating speech.</p>
              <button onClick={() => onNavigate?.('voice-clone')}
                style={{ fontSize: 13, fontWeight: 600, color: C.white, background: C.accent, border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer' }}>
                Clone a voice
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textGray, margin: 0 }}>No voices match {voiceFilter === 'favorites' ? 'your favorites' : 'that search'}.</p>
          ) : (
            <div className="voice-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, width: '100%', alignItems: 'stretch' }}>
              {filtered.map(v => {
                const active = selectedVoice === v.id
                return (
                  <div
                    key={v.id}
                    role="option"
                    aria-selected={active}
                    tabIndex={0}
                    onClick={() => setSelectedVoice(v.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedVoice(v.id) } }}
                    className="voice-card"
                    style={{
                      position: 'relative', display: 'flex', flexDirection: 'column',
                      borderRadius: 16, padding: '18px 18px 16px',
                      minWidth: 0, minHeight: 238, height: '100%',
                      border: active ? `2px solid ${C.accent}` : `1px solid #ECECF3`,
                      background: active ? C.accentLight : C.white,
                      cursor: 'pointer', transition: 'all 0.18s',
                      boxShadow: active
                        ? `0 0 0 3px rgba(100,65,224,0.08), 0 8px 28px -10px rgba(15,23,42,0.06)`
                        : '0 8px 28px -10px rgba(15,23,42,0.06)',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(15,23,42,0.10)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 28px -10px rgba(15,23,42,0.06)' } }}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); void toggleFavorite(v) }}
                      aria-label={v.favorite ? `Remove ${v.name} from favorites` : `Add ${v.name} to favorites`}
                      aria-pressed={v.favorite}
                      style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={v.favorite ? C.accent : '#D7DCE6'} strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={v.favorite ? C.accent : 'none'} />
                      </svg>
                    </button>
                    {v.avatarUrl ? (
                      <img aria-hidden src={`${import.meta.env.BASE_URL}${v.avatarUrl.replace(/^\//, '')}`} alt="" style={{ width: 48, height: 48, borderRadius: '50%', marginBottom: 10, objectFit: 'cover', objectPosition: 'center 18%', display: 'block' }} />
                    ) : (
                    <div aria-hidden style={{ width: 48, height: 48, borderRadius: '50%', marginBottom: 10, background: avatarColor(v.id), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600 }}>
                      {v.name.charAt(0).toUpperCase()}
                    </div>
                    )}
                    <div style={{ fontSize: 18, fontWeight: 600, color: C.black, lineHeight: 1.2 }}>{v.name}</div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, borderRadius: 20, padding: '2px 8px', marginTop: 4, alignSelf: 'flex-start', textTransform: 'capitalize' }}>{v.category}</span>
                    <div style={{ fontSize: 13, color: C.textGray, marginTop: 8, lineHeight: 1.5, flex: 1, overflow: 'hidden' }}>{v.description || 'Cloned from your reference recording'}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <VoiceCardPlayButton state={previewState(v.id)} onClick={() => void handlePreview(v)} label={`Play ${v.name} preview`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Generations */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Recent Generations</h2>
            <button onClick={() => onNavigate?.('history')}
              style={{ fontSize: 13, fontWeight: 500, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accentHover)}
              onMouseLeave={e => (e.currentTarget.style.color = C.accent)}>View all</button>
          </div>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textGray, margin: 0 }}>Nothing generated yet — your generations will appear here.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {recent.map((item, i) => (
                    <tr key={item.id} style={{ borderTop: i > 0 ? `1px solid ${C.borderLight}` : undefined }}>
                      <td style={{ padding: '12px 12px 12px 0', width: 44 }}>
                        <PlayButton size={36} state={historyPlayState(item)} onClick={() => playHistoryItem(item)} label={`Play ${item.title}`} />
                      </td>
                      <td style={{ padding: '12px 20px 12px 0' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: C.black }}>{item.title}</span>
                        {item.status !== 'completed' && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: item.status === 'failed' ? C.red : C.textGray, marginLeft: 8, textTransform: 'capitalize' }}>{item.status}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 20px 12px 0', fontSize: 13, color: C.textGray, whiteSpace: 'nowrap' }}>{item.voiceName} · {formatWhen(item.createdAt)}</td>
                      <td style={{ padding: '12px 20px 12px 0', fontSize: 13, color: C.textGray, fontFamily: 'monospace' }}>{formatDuration(item.durationSeconds)}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, position: 'relative' }}>
                          <button onClick={() => downloadItem(item)} aria-label={`Download ${item.title}`} disabled={item.status !== 'completed'}
                            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: item.status === 'completed' ? 'pointer' : 'not-allowed', color: C.textGray, transition: 'all 0.15s', opacity: item.status === 'completed' ? 1 : 0.4 }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.accent }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textGray }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); setMenuFor(menuFor === item.id ? null : item.id) }} aria-label={`More actions for ${item.title}`} aria-expanded={menuFor === item.id}
                            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: menuFor === item.id ? C.accentLight : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: menuFor === item.id ? C.accent : C.textGray, transition: 'all 0.15s' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>
                          </button>
                          {menuFor === item.id && (
                            <div role="menu" style={{ position: 'absolute', top: 34, right: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, minWidth: 140, padding: 4 }}>
                              <button role="menuitem" onClick={() => { setText(item.text); setMenuFor(null) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 13, color: C.black, background: 'none', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                Reuse text
                              </button>
                              <button role="menuitem" onClick={() => { setDeleteTarget(item); setMenuFor(null) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 13, color: C.red, background: 'none', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.redBg)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────────────── */}
      <div className="voice-settings-column" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 20px' }}>Voice Settings</h2>

          <p style={{ fontSize: 12, color: C.textGray, margin: '0 0 8px' }}>Selected Voice</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            {selected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {selected.avatarUrl ? (
                  <img aria-hidden src={`${import.meta.env.BASE_URL}${selected.avatarUrl.replace(/^\//, '')}`} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 18%', flexShrink: 0, display: 'block' }} />
                ) : (
                <div aria-hidden style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(selected.id), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: C.textGray, textTransform: 'capitalize' }}>{selected.category}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.textGray }}>No voice selected</div>
            )}
            <button onClick={() => onNavigate?.('my-voices')}
              style={{ fontSize: 12, fontWeight: 500, color: C.black, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', background: C.white, cursor: 'pointer', transition: 'background 0.15s', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}>Change</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Speed</span>
                <span style={{ fontSize: 12, color: C.textGray }}>{speed.toFixed(2)}x</span>
              </div>
              <Slider value={speed} min={0.5} max={2} step={0.05} onChange={setSpeed} label="Speech speed" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Pitch</span>
                <span style={{ fontSize: 12, color: C.textGray }}>{pitch > 0 ? `+${pitch}` : pitch}</span>
              </div>
              <Slider value={pitch} min={-12} max={12} step={1} onChange={setPitch} label="Voice pitch" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Stability</span>
                <span style={{ fontSize: 12, color: C.textGray }}>Unavailable</span>
              </div>
              <Slider value={75} disabled disabledReason={unavailable('stability')} label="Stability (unavailable)" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Similarity</span>
                <span style={{ fontSize: 12, color: C.textGray }}>Unavailable</span>
              </div>
              <Slider value={85} disabled disabledReason={unavailable('similarity')} label="Similarity (unavailable)" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Speaking Style</span>
              <SelectDropdown value="Default" disabled disabledReason={unavailable('emotion')} label="Speaking style (unavailable)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Role</span>
              <SelectDropdown value="Default" disabled disabledReason="Role presets are not supported by the F5-TTS engine." label="Role (unavailable)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Add natural pauses</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span title="Inserts a short pause between paragraphs before generating" style={{ lineHeight: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textGray} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                <Toggle checked={naturalPauses} onChange={setNaturalPauses} label="Add natural pauses" />
              </div>
            </div>
          </div>

          {generating && (
            <div style={{ marginBottom: 12 }}>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={genProgress} aria-label="Generation progress"
                style={{ height: 6, borderRadius: 3, background: C.borderLight, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${Math.max(4, genProgress)}%`, background: C.accent, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.textGray }}>{genPhase === 'submitting' ? 'Starting…' : `Generating… ${genProgress}%`}</span>
                <button onClick={() => void handleCancelGeneration()} style={{ fontSize: 12, fontWeight: 600, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
              </div>
            </div>
          )}

          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            aria-busy={generating}
            style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: generating ? C.accentHover : C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: 'none', cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s', opacity: generating ? 0.8 : 1 }}
            onMouseEnter={e => { if (!generating) e.currentTarget.style.background = C.accentHover }}
            onMouseLeave={e => { if (!generating) e.currentTarget.style.background = C.accent }}
          >
            <WaveformIcon size={16} color={C.white} />
            {generating ? 'Generating…' : 'Generate Speech'}
          </button>

          {genPhase === 'failed' && genError && (
            <div role="alert" style={{ marginTop: 10, fontSize: 12, color: C.red, lineHeight: 1.5 }}>
              {genError}
              <button onClick={() => void handleGenerate()} style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Retry</button>
            </div>
          )}

          {genPhase === 'success' && genResult && (
            <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <PlayButton size={32} state={historyPlayState(genResult)} onClick={() => playHistoryItem(genResult)} label="Play generated audio" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{genResult.title}</div>
                  <div style={{ fontSize: 11, color: C.textGray }}>{formatDuration(genResult.durationSeconds)}</div>
                </div>
                <button onClick={() => downloadItem(genResult)} aria-label="Download generated audio"
                  style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textGray }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.accent }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textGray }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>
              {audio.trackId === `history-${genResult.id}` && audio.duration > 0 && (
                <Slider value={Math.round((audio.currentTime / audio.duration) * 100)} min={0} max={100} step={1}
                  onChange={pct => audioManager.seek((pct / 100) * audio.duration)} label="Seek generated audio" />
              )}
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: C.textGray, margin: '8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {text.length} characters · {selected ? selected.name : 'no voice selected'}
          </p>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Output Format</span>
            <SelectDropdown value={outputFormat} options={[{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3' }]} onChange={setOutputFormat} label="Output format" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Sample Rate</span>
            <SelectDropdown value={sampleRate} options={[{ value: '16000', label: '16 kHz' }, { value: '22050', label: '22 kHz' }, { value: '24000', label: '24 kHz' }, { value: '44100', label: '44.1 kHz' }, { value: '48000', label: '48 kHz' }]} onChange={setSampleRate} label="Sample rate" />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete generation?"
        message={`"${deleteTarget?.title ?? ''}" and its audio will be permanently deleted.`}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
