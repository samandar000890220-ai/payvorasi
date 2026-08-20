import { useCallback, useEffect, useRef, useState } from 'react'
import { C } from '../tokens'
import { VoiceCardPlayButton, MiniWaveform, StatusBadge, SearchBar, Card, Divider, ConfirmDialog } from '../components/Shared'
import {
  listVoices, updateVoice, uploadVoice, deleteVoice, duplicateVoice, previewVoice,
  waitForGeneration, generationAudioUrl, voiceAudioUrl,
  type VoiceSummary,
} from '../api'
import { audioManager, useAudioState } from '../audioManager'

const AVATAR_COLORS = ['#6441E0', '#0EA5E9', '#F97316', '#10B981', '#EC4899', '#8B5CF6']
const avatarColor = (id: string) => AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

const ACCEPTED = '.mp3,.wav,.flac,.m4a,.ogg,.webm,audio/*'
const MAX_BYTES = 50 * 1024 * 1024

type UploadPhase = 'idle' | 'uploading' | 'success' | 'failure'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ActionBtn({ label, icon, primary, danger, disabled, disabledReason, onClick }: {
  label: string; icon: React.ReactNode; primary?: boolean; danger?: boolean
  disabled?: boolean; disabledReason?: string; onClick?: () => void
}) {
  const [h, setH] = useState(false)
  const bg = primary ? (h ? C.accentHover : C.accent) : danger ? (h ? C.redBg : 'transparent') : (h ? C.accentLight : 'transparent')
  const col = primary ? C.white : danger ? (h ? C.red : C.textGray) : (h ? C.accent : C.textGray)
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', borderRadius: 10, border: primary ? 'none' : `1px solid ${C.border}`, background: bg, color: col, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 }}
    >
      {icon}{label}
    </button>
  )
}

const UploadIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const PlayIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const EditIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const RefreshIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
const CopyIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const MicIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>

export default function VoiceClone({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const [voices, setVoices] = useState<VoiceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Upload / clone flow
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; label: string } | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Recording
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Editing / deleting
  const [renaming, setRenaming] = useState<VoiceSummary | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VoiceSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Preview playback
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const previewCache = useRef<Map<string, string>>(new Map())
  const unmountAbort = useRef(new AbortController())
  useEffect(() => {
    const controller = unmountAbort.current
    return () => controller.abort()
  }, [])
  const audio = useAudioState()

  const refresh = useCallback(async () => {
    try {
      setLoadError(null)
      setVoices(await listVoices())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load voices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => () => { // stop recording if the tab unmounts
    recorderRef.current?.stream.getTracks().forEach(t => t.stop())
    if (recordTimer.current) clearInterval(recordTimer.current)
  }, [])

  const selectedVoice = voices.find(v => v.id === selected) ?? null

  const filtered = voices.filter(v =>
    (filter !== 'favorites' || v.favorite) &&
    (filter !== 'recently used' || v.lastUsedAt !== null) &&
    (v.name.toLowerCase().includes(search.toLowerCase()) || (v.description ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  // ── File intake ──────────────────────────────────────────────────────────
  const acceptFile = (file: File) => {
    setUploadError(null)
    if (file.size > MAX_BYTES) { setUploadError('That file is larger than 50 MB.'); return }
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|ogg|webm)$/i.test(file.name)) {
      setUploadError('Unsupported file. Use MP3, WAV, FLAC, M4A, OGG, or WebM audio.'); return
    }
    setPendingAudio({ blob: file, label: file.name })
    setNameDraft(file.name.replace(/\.[^.]+$/, '').slice(0, 80))
  }

  const startRecording = async () => {
    setUploadError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (recordTimer.current) clearInterval(recordTimer.current)
        setRecording(false)
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size < 4096) { setUploadError('The recording was too short. Record at least a few seconds.'); return }
        setPendingAudio({ blob, label: 'Microphone recording' })
        setNameDraft('My recorded voice')
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordSeconds(0)
      recordTimer.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      setUploadError('Microphone access was denied or is unavailable in this browser.')
    }
  }

  const stopRecording = () => recorderRef.current?.stop()

  const submitClone = async () => {
    if (!pendingAudio || uploadPhase === 'uploading') return
    const name = nameDraft.trim()
    if (!name) { setUploadError('Give this voice a name.'); return }
    setUploadPhase('uploading')
    setUploadError(null)
    try {
      const created = await uploadVoice(pendingAudio.blob, name)
      setUploadPhase('success')
      setPendingAudio(null)
      setNameDraft('')
      await refresh()
      setSelected(created.id)
      setNotice(`"${created.name}" is ready — it's now available in Voice Studio.`)
      setTimeout(() => setUploadPhase('idle'), 400)
    } catch (error) {
      setUploadPhase('failure')
      setUploadError(error instanceof Error ? error.message : 'Upload failed. Try again.')
    }
  }

  // ── Card / detail actions ───────────────────────────────────────────────
  const handlePreview = async (voice: VoiceSummary) => {
    const trackId = `clone-preview-${voice.id}`
    const cached = previewCache.current.get(voice.id)
    if (cached) { void audioManager.toggle(trackId, cached); return }
    if (previewLoading) return
    setPreviewLoading(voice.id)
    setNotice(null)
    try {
      const genId = await previewVoice(voice.id)
      const done = await waitForGeneration(genId, undefined, unmountAbort.current.signal)
      if (done.status !== 'completed') throw new Error(done.error ?? 'Preview generation failed.')
      const url = generationAudioUrl(genId)
      previewCache.current.set(voice.id, url)
      if (!unmountAbort.current.signal.aborted) void audioManager.toggle(trackId, url)
    } catch (error) {
      if (unmountAbort.current.signal.aborted) return
      setNotice(error instanceof Error ? error.message : 'Preview failed.')
    } finally {
      if (!unmountAbort.current.signal.aborted) setPreviewLoading(null)
    }
  }

  const playReference = (voice: VoiceSummary) =>
    void audioManager.toggle(`clone-ref-${voice.id}`, voiceAudioUrl(voice.id))

  const previewState = (voiceId: string): 'idle' | 'loading' | 'playing' | 'paused' => {
    if (previewLoading === voiceId) return 'loading'
    if (audio.trackId === `clone-preview-${voiceId}`) {
      if (audio.status === 'playing') return 'playing'
      if (audio.status === 'loading') return 'loading'
      if (audio.status === 'paused') return 'paused'
    }
    return 'idle'
  }

  const toggleFavorite = async (voice: VoiceSummary) => {
    setVoices(vs => vs.map(v => v.id === voice.id ? { ...v, favorite: !v.favorite } : v))
    try { await updateVoice(voice.id, { favorite: !voice.favorite }) }
    catch { setVoices(vs => vs.map(v => v.id === voice.id ? { ...v, favorite: voice.favorite } : v)); setNotice('Could not update favorite.') }
  }

  const submitRename = async () => {
    if (!renaming || renameBusy) return
    const name = renameDraft.trim()
    if (!name) return
    setRenameBusy(true)
    try {
      await updateVoice(renaming.id, { name })
      setRenaming(null)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Rename failed.')
    } finally {
      setRenameBusy(false)
    }
  }

  const handleDuplicate = async (voice: VoiceSummary) => {
    if (busyAction) return
    setBusyAction('duplicate')
    try {
      const copy = await duplicateVoice(voice.id)
      await refresh()
      setSelected(copy.id)
      setNotice(`Duplicated as "${copy.name}".`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Duplicate failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await deleteVoice(deleteTarget.id)
      if (selected === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Delete failed.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      <input ref={fileInputRef} type="file" accept={ACCEPTED} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); e.target.value = '' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>Voice Clone</h1>
          <p style={{ fontSize: 14, color: C.textGray, margin: '4px 0 0' }}>Create realistic AI voice clones from recordings in minutes.</p>
        </div>
        <div className="vs-page-header-actions" style={{ display: 'flex', gap: 10 }}>
          <button onClick={openFilePicker}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: C.white, color: C.black, border: `1px solid ${C.border}` }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>Upload Files</button>
          <button onClick={() => (recording ? stopRecording() : void startRecording())}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: recording ? C.redBg : C.white, color: recording ? C.red : C.black, border: `1px solid ${recording ? C.red : C.border}` }}
            onMouseEnter={e => { if (!recording) e.currentTarget.style.background = C.accentLight }}
            onMouseLeave={e => { if (!recording) e.currentTarget.style.background = C.white }}>
            {recording ? `Stop (${recordSeconds}s)` : 'Record Voice'}
          </button>
          <button onClick={openFilePicker}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: C.accent, color: C.white, border: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = C.accent)}>+ New Voice</button>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ marginBottom: 16, fontSize: 13, color: C.accent, background: C.accentLight, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0 }}>×</button>
        </div>
      )}

      <div className="vs-two-col" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Left: voice library ──────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <SearchBar placeholder="Search voices..." value={search} onChange={setSearch} />
            <div style={{ display: 'flex', gap: 4 }}>
              {['All', 'Favorites', 'Recently Used'].map(f => (
                <button key={f}
                  aria-pressed={filter === f.toLowerCase()}
                  style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${filter === f.toLowerCase() ? C.accent : C.border}`, background: filter === f.toLowerCase() ? C.accentLight : C.white, color: filter === f.toLowerCase() ? C.accent : C.textGray, transition: 'all 0.15s' }}
                  onClick={() => setFilter(f.toLowerCase())}
                >{f}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: C.textGray }}>Loading voices…</p>
          ) : loadError ? (
            <div role="alert" style={{ fontSize: 13, color: C.red, display: 'flex', gap: 12, alignItems: 'center' }}>
              {loadError}
              <button onClick={() => { setLoading(true); void refresh() }} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: C.accentLight, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>Retry</button>
            </div>
          ) : (
            <div className="vc-voice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {/* Create New card */}
              <div
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker() } }}
                style={{ borderRadius: 16, border: `1.5px dashed ${C.border}`, background: C.white, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', minHeight: 200, transition: 'all 0.15s', textAlign: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentLight }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>Create New Voice</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 4 }}>
                  <button onClick={e => { e.stopPropagation(); openFilePicker() }}
                    style={{ fontSize: 12, fontWeight: 500, color: C.accent, background: C.accentLight, border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Upload Audio</button>
                  <button onClick={e => { e.stopPropagation(); recording ? stopRecording() : void startRecording() }}
                    style={{ fontSize: 12, fontWeight: 500, color: recording ? C.red : C.accent, background: recording ? C.redBg : C.accentLight, border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                    {recording ? `Stop Recording (${recordSeconds}s)` : 'Record Voice'}
                  </button>
                  <button disabled title="Cloning from a URL is not supported yet — upload a file or record instead."
                    style={{ fontSize: 12, fontWeight: 500, color: C.textGray, background: C.borderLight, border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'not-allowed' }}>
                    Clone URL (unavailable)
                  </button>
                </div>
              </div>

              {/* Voice cards */}
              {filtered.map(v => {
                const isActive = selected === v.id
                return (
                  <div
                    key={v.id}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => setSelected(isActive ? null : v.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isActive ? null : v.id) } }}
                    style={{
                      borderRadius: 16, border: `1px solid ${isActive ? C.accent : C.border}`,
                      background: C.white, padding: 16, cursor: 'pointer', transition: 'all 0.18s',
                      boxShadow: isActive ? `0 0 0 3px rgba(100,65,224,0.10)` : '0 2px 8px rgba(15,23,42,0.04)',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.08)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div aria-hidden style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(v.id), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); void toggleFavorite(v) }}
                          aria-label={v.favorite ? `Unfavorite ${v.name}` : `Favorite ${v.name}`} aria-pressed={v.favorite}
                          style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: v.favorite ? C.accent : C.textGray }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={v.favorite ? C.accent : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                        <button onClick={e => { e.stopPropagation(); setRenaming(v); setRenameDraft(v.name) }}
                          aria-label={`Rename ${v.name}`}
                          style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textGray }}>
                          <EditIcon />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: C.textGray, marginTop: 2, marginBottom: 8 }}>{v.description || 'Cloned voice'}</div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      <StatusBadge status="active" />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <MiniWaveform active={isActive} h={24} />
                    </div>

                    <Divider />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.textGray }}>Created {formatDate(v.createdAt)}</div>
                        <div style={{ fontSize: 11, color: C.textGray, marginTop: 1 }}>{v.lastUsedAt ? `Used ${formatDate(v.lastUsedAt)}` : 'Not used yet'}</div>
                      </div>
                      <VoiceCardPlayButton state={previewState(v.id)} onClick={() => void handlePreview(v)} label={`Preview ${v.name}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && !loadError && voices.length === 0 && (
            <p style={{ fontSize: 13, color: C.textGray, marginTop: 16 }}>
              No cloned voices yet — upload a recording or record your voice to create your first clone.
            </p>
          )}
        </div>

        {/* ── Right: details / upload panel ─────────────────────────────── */}
        <div className="vs-layout-side" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedVoice ? (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: 16 }}>
                <div aria-hidden style={{ width: 80, height: 80, borderRadius: '50%', background: avatarColor(selectedVoice.id), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 600, marginBottom: 12 }}>
                  {selectedVoice.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.black }}>{selectedVoice.name}</div>
                <div style={{ fontSize: 13, color: C.textGray, marginTop: 3 }}>{selectedVoice.description || 'Cloned voice'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <StatusBadge status="active" />
                </div>
              </div>
              <Divider />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
                {[
                  { label: 'Category', value: selectedVoice.category },
                  { label: 'Created', value: formatDate(selectedVoice.createdAt) },
                  { label: 'Last used', value: selectedVoice.lastUsedAt ? formatDate(selectedVoice.lastUsedAt) : 'Never' },
                  { label: 'Favorite', value: selectedVoice.favorite ? 'Yes' : 'No' },
                  { label: 'Engine', value: 'F5-TTS' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: C.textGray }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.black, textTransform: row.label === 'Category' ? 'capitalize' : undefined }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <Divider />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <ActionBtn primary label={previewState(selectedVoice.id) === 'playing' ? 'Pause Sample' : 'Play Sample'} icon={<PlayIcon />} onClick={() => void handlePreview(selectedVoice)} />
                <ActionBtn label="Play Reference" icon={<MicIcon />} onClick={() => playReference(selectedVoice)} />
                <ActionBtn label="Rename" icon={<EditIcon />} onClick={() => { setRenaming(selectedVoice); setRenameDraft(selectedVoice.name) }} />
                <ActionBtn label="Retrain" icon={<RefreshIcon />} disabled disabledReason="F5-TTS clones directly from the reference recording — there is no training step to re-run. Upload a new recording instead." />
                <ActionBtn label={busyAction === 'duplicate' ? 'Duplicating…' : 'Duplicate'} icon={<CopyIcon />} disabled={busyAction !== null} onClick={() => void handleDuplicate(selectedVoice)} />
                <ActionBtn danger label="Delete Voice" icon={<TrashIcon />} onClick={() => setDeleteTarget(selectedVoice)} />
                <ActionBtn label="Use in Voice Studio" icon={<PlayIcon />} onClick={() => { sessionStorage.setItem('payvora-use-voice', selectedVoice.id); onNavigate?.('text-to-speech') }} />
              </div>
            </Card>
          ) : (
            <>
              {/* Upload area */}
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 14px' }}>Upload Voice Sample</h3>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openFilePicker}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker() } }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) acceptFile(f) }}
                  style={{
                    border: `1.5px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 12, padding: '28px 20px',
                    textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', background: dragOver ? C.accentLight : 'transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentLight }}
                  onMouseLeave={e => { if (!dragOver) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent' } }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: C.accent }}>
                    <UploadIcon />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 4 }}>Drag & drop audio</div>
                  <div style={{ fontSize: 12, color: C.textGray, marginBottom: 12 }}>or click to browse</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {['MP3', 'WAV', 'FLAC', 'M4A'].map(fmt => (
                      <span key={fmt} style={{ fontSize: 11, fontWeight: 600, color: C.textGray, background: C.borderLight, borderRadius: 6, padding: '2px 8px' }}>{fmt}</span>
                    ))}
                  </div>
                </div>
                {uploadError && !pendingAudio && (
                  <p role="alert" style={{ fontSize: 12, color: C.red, margin: '10px 0 0', lineHeight: 1.5 }}>{uploadError}</p>
                )}
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 4 }}>Requirements</div>
                  {['A few seconds to ~1 minute of clear speech', 'Minimal background noise', 'Single speaker only', 'Consistent volume'].map(tip => (
                    <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textGray }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={C.green} strokeWidth="1.5"/><polyline points="3.5,6 5,7.5 8.5,4" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {tip}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick tips */}
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 12px' }}>Quick Tips</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Use clean recordings.', 'Avoid background noise.', 'Speak naturally.', 'Use one speaker only.', 'Record at consistent volume.'].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>{i + 1}</span>
                      </div>
                      <span style={{ fontSize: 13, color: C.textGray, lineHeight: 1.5 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ── Name & confirm clone dialog ─────────────────────────────────── */}
      {pendingAudio && (
        <div role="presentation" onClick={() => uploadPhase !== 'uploading' && setPendingAudio(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Name your voice" onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: '0 0 4px' }}>Create voice clone</h2>
            <p style={{ fontSize: 13, color: C.textGray, margin: '0 0 16px' }}>Source: {pendingAudio.label}</p>
            <label htmlFor="clone-name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.black, marginBottom: 6 }}>Voice name</label>
            <input
              id="clone-name"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value.slice(0, 80))}
              onKeyDown={e => { if (e.key === 'Enter') void submitClone() }}
              autoFocus
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.black, outline: 'none', marginBottom: 12 }}
              placeholder="e.g. My narration voice"
            />
            {uploadError && <p role="alert" style={{ fontSize: 12, color: C.red, margin: '0 0 12px' }}>{uploadError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPendingAudio(null)} disabled={uploadPhase === 'uploading'}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 14, fontWeight: 500, color: C.black, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void submitClone()} disabled={uploadPhase === 'uploading'}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, fontSize: 14, fontWeight: 600, color: C.white, cursor: uploadPhase === 'uploading' ? 'wait' : 'pointer', opacity: uploadPhase === 'uploading' ? 0.7 : 1 }}>
                {uploadPhase === 'uploading' ? 'Cloning…' : 'Create Voice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename dialog ────────────────────────────────────────────────── */}
      {renaming && (
        <div role="presentation" onClick={() => !renameBusy && setRenaming(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Rename voice" onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: '0 0 12px' }}>Rename voice</h2>
            <input
              value={renameDraft}
              onChange={e => setRenameDraft(e.target.value.slice(0, 80))}
              onKeyDown={e => { if (e.key === 'Enter') void submitRename() }}
              autoFocus
              aria-label="New voice name"
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.black, outline: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setRenaming(null)} disabled={renameBusy}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 14, fontWeight: 500, color: C.black, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void submitRename()} disabled={renameBusy || !renameDraft.trim()}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, fontSize: 14, fontWeight: 600, color: C.white, cursor: renameBusy ? 'wait' : 'pointer', opacity: renameBusy ? 0.7 : 1 }}>
                {renameBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete voice?"
        message={`"${deleteTarget?.name ?? ''}" and its reference audio will be permanently deleted. Generations made with it stay in History.`}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
