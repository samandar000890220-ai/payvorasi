import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { C } from '../tokens'
import { SearchBar, Card, Divider, ConfirmDialog } from '../components/Shared'
import {
  listVoices, updateVoice, deleteVoice, duplicateVoice, previewVoice,
  waitForGeneration, generationAudioUrl, voiceAudioUrl, listHistory,
  type VoiceSummary, type GenerationRecord,
} from '../api'
import { audioManager, useAudioState } from '../audioManager'

const AVATAR_COLORS = ['#6441E0', '#0EA5E9', '#F97316', '#10B981', '#EC4899', '#8B5CF6']
const avatarColor = (id: string) => AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

const CATEGORIES = ['All', 'Favorites', 'Recently Used']

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function formatHours(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600), m = Math.round((totalSeconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

type Busy = { id: string; action: string } | null

function VoiceCard({ v, usage, generatedSeconds, previewState, onUse, onPreview, onEdit, onDuplicate, onDownload, onDelete, onFavorite, busy }: {
  v: VoiceSummary
  usage: number
  generatedSeconds: number
  previewState: 'idle' | 'loading' | 'playing' | 'paused'
  onUse: () => void
  onPreview: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDownload: () => void
  onDelete: () => void
  onFavorite: () => void
  busy: Busy
}) {
  const isBusy = (action: string) => busy?.id === v.id && busy.action === action
  const actions = [
    { title: 'Preview', onClick: onPreview, loading: previewState === 'loading', icon: previewState === 'playing'
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
    { title: 'Edit', onClick: onEdit, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
    { title: 'Duplicate', onClick: onDuplicate, loading: isBusy('duplicate'), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
    { title: 'Download', onClick: onDownload, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
    { title: 'Delete', onClick: onDelete, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> },
  ]
  return (
    <div
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', transition: 'all 0.18s', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,23,42,0.09)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)' }}
    >
      {/* Banner + fav star */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        {v.avatarUrl ? (
          <div aria-hidden style={{ width: '100%', height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            <img src={`${import.meta.env.BASE_URL}${v.avatarUrl.replace(/^\//, '')}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%', display: 'block' }} />
          </div>
        ) : (
        <div aria-hidden style={{ width: '100%', height: 100, borderRadius: 12, background: `linear-gradient(135deg, ${avatarColor(v.id)}22, ${avatarColor(v.id)}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarColor(v.id), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
            {v.name.charAt(0).toUpperCase()}
          </div>
        </div>
        )}
        <button
          onClick={onFavorite}
          aria-label={v.favorite ? `Remove ${v.name} from favorites` : `Add ${v.name} to favorites`}
          aria-pressed={v.favorite}
          style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'transform 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={v.favorite ? '#F59E0B' : 'none'} stroke={v.favorite ? '#F59E0B' : C.textGray} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, fontWeight: 600, color: C.accent, background: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: '2px 7px', backdropFilter: 'blur(4px)', textTransform: 'capitalize' }}>{v.category}</span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 4 }}>{v.name}</div>
      <div style={{ fontSize: 13, color: C.textGray, marginBottom: 10, lineHeight: 1.4 }}>{v.description || 'Cloned from your reference recording'}</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.textGray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Used</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{usage}x</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textGray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Generated</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{formatHours(generatedSeconds)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textGray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Created</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.black }}>{formatDate(v.createdAt)}</div>
        </div>
      </div>

      <Divider />

      {/* Actions */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={onUse}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, background: C.accent, color: C.white, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
          onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
        >Use Voice</button>
        <div style={{ display: 'flex', gap: 6 }}>
          {actions.map(btn => (
            <button key={btn.title} title={btn.title} aria-label={`${btn.title} ${v.name}`} onClick={btn.onClick} disabled={btn.loading}
              style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, cursor: btn.loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textGray, transition: 'all 0.15s', opacity: btn.loading ? 0.5 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.background = btn.title === 'Delete' ? C.redBg : C.accentLight; e.currentTarget.style.color = btn.title === 'Delete' ? C.red : C.accent; e.currentTarget.style.borderColor = btn.title === 'Delete' ? C.red : C.accent }}
              onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textGray; e.currentTarget.style.borderColor = C.border }}>
              {btn.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MyVoices({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [voices, setVoices] = useState<VoiceSummary[]>([])
  const [history, setHistory] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [renaming, setRenaming] = useState<VoiceSummary | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VoiceSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
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
      const [vs, hs] = await Promise.all([listVoices(), listHistory().catch(() => [] as GenerationRecord[])])
      setVoices(vs)
      setHistory(hs)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load voices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Real usage stats from generation history
  const usageByVoice = useMemo(() => {
    const map = new Map<string, { count: number; seconds: number }>()
    for (const g of history) {
      if (!g.voiceId) continue
      const entry = map.get(g.voiceId) ?? { count: 0, seconds: 0 }
      entry.count += 1
      entry.seconds += g.durationSeconds ?? 0
      map.set(g.voiceId, entry)
    }
    return map
  }, [history])

  const totalGeneratedSeconds = useMemo(() => history.reduce((a, g) => a + (g.durationSeconds ?? 0), 0), [history])
  const mostUsed = useMemo(() => {
    let best: { name: string; count: number } | null = null
    for (const v of voices) {
      const count = usageByVoice.get(v.id)?.count ?? 0
      if (!best || count > best.count) best = { name: v.name, count }
    }
    return best && best.count > 0 ? best.name : '—'
  }, [voices, usageByVoice])

  const favorites = voices.filter(v => v.favorite)
  const displayed = voices.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase()) || (v.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || (category === 'Favorites' && v.favorite) || (category === 'Recently Used' && v.lastUsedAt !== null)
    return matchSearch && matchCat
  })
  const recentlyUsed = voices.filter(v => v.lastUsedAt !== null)
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, 4)

  // ── Actions ──────────────────────────────────────────────────────────────
  const useVoice = (v: VoiceSummary) => {
    sessionStorage.setItem('payvora-use-voice', v.id)
    onNavigate?.('text-to-speech')
  }

  const handlePreview = async (v: VoiceSummary) => {
    const trackId = `mv-preview-${v.id}`
    const cached = previewCache.current.get(v.id)
    if (cached) { void audioManager.toggle(trackId, cached); return }
    if (previewLoading) return
    setPreviewLoading(v.id)
    setNotice(null)
    try {
      const genId = await previewVoice(v.id)
      const done = await waitForGeneration(genId, undefined, unmountAbort.current.signal)
      if (done.status !== 'completed') throw new Error(done.error ?? 'Preview generation failed.')
      const url = generationAudioUrl(genId)
      previewCache.current.set(v.id, url)
      if (!unmountAbort.current.signal.aborted) void audioManager.toggle(trackId, url)
    } catch (error) {
      if (unmountAbort.current.signal.aborted) return
      setNotice(error instanceof Error ? error.message : 'Preview failed.')
    } finally {
      if (!unmountAbort.current.signal.aborted) setPreviewLoading(null)
    }
  }

  const previewState = (id: string): 'idle' | 'loading' | 'playing' | 'paused' => {
    if (previewLoading === id) return 'loading'
    if (audio.trackId === `mv-preview-${id}`) {
      if (audio.status === 'playing') return 'playing'
      if (audio.status === 'loading') return 'loading'
      if (audio.status === 'paused') return 'paused'
    }
    return 'idle'
  }

  const toggleFavorite = async (v: VoiceSummary) => {
    setVoices(vs => vs.map(x => x.id === v.id ? { ...x, favorite: !x.favorite } : x))
    try { await updateVoice(v.id, { favorite: !v.favorite }) }
    catch { setVoices(vs => vs.map(x => x.id === v.id ? { ...x, favorite: v.favorite } : x)); setNotice('Could not update favorite.') }
  }

  const handleDuplicate = async (v: VoiceSummary) => {
    if (busy) return
    setBusy({ id: v.id, action: 'duplicate' })
    try {
      const copy = await duplicateVoice(v.id)
      await refresh()
      setNotice(`Duplicated as "${copy.name}".`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Duplicate failed.')
    } finally {
      setBusy(null)
    }
  }

  const handleDownload = (v: VoiceSummary) => {
    const a = document.createElement('a')
    a.href = voiceAudioUrl(v.id)
    a.download = `${v.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'voice'}-reference.wav`
    document.body.appendChild(a); a.click(); a.remove()
  }

  const submitRename = async () => {
    if (!renaming || renameBusy) return
    const name = renameDraft.trim()
    if (!name) return
    setRenameBusy(true)
    try {
      await updateVoice(renaming.id, { name, description: descDraft })
      setRenaming(null)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setRenameBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await deleteVoice(deleteTarget.id)
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Delete failed.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const cardProps = (v: VoiceSummary) => ({
    v,
    usage: usageByVoice.get(v.id)?.count ?? 0,
    generatedSeconds: usageByVoice.get(v.id)?.seconds ?? 0,
    previewState: previewState(v.id),
    onUse: () => useVoice(v),
    onPreview: () => void handlePreview(v),
    onEdit: () => { setRenaming(v); setRenameDraft(v.name); setDescDraft(v.description ?? '') },
    onDuplicate: () => void handleDuplicate(v),
    onDownload: () => handleDownload(v),
    onDelete: () => setDeleteTarget(v),
    onFavorite: () => void toggleFavorite(v),
    busy,
  })

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>My Voices</h1>
          <p style={{ fontSize: 14, color: C.textGray, margin: '4px 0 0' }}>Manage all of your custom AI voices in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onNavigate?.('voice-clone')}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.white, color: C.black, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>Import Voice</button>
          <button onClick={() => onNavigate?.('voice-clone')}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: C.accent, color: C.white, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = C.accent)}>+ Create Voice</button>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ marginBottom: 16, fontSize: 13, color: C.accent, background: C.accentLight, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0 }}>×</button>
        </div>
      )}

      <div className="vs-two-col" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search + category filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <SearchBar placeholder="Search voices..." value={search} onChange={setSearch} />
            <div className="mv-category-bar" style={{ display: 'flex', gap: 2, background: C.borderLight, borderRadius: 12, padding: 4, flexShrink: 0 }}>
              {CATEGORIES.map(cat => (
                <button key={cat}
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: category === cat ? C.white : 'transparent', color: category === cat ? C.black : C.textGray, boxShadow: category === cat ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
                >{cat}</button>
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
            <>
              {/* Favorites pinned row */}
              {(category === 'All' || category === 'Favorites') && favorites.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>Favorites</span>
                    <span style={{ fontSize: 12, color: C.textGray }}>({favorites.length})</span>
                  </div>
                  <div className="mv-voice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    {favorites.map(v => <VoiceCard key={v.id} {...cardProps(v)} />)}
                  </div>
                </div>
              )}

              {/* All voices grid */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>All Voices</span>
                  <span style={{ fontSize: 12, color: C.textGray }}>({displayed.length})</span>
                </div>
                {displayed.length > 0 ? (
                  <div className="mv-voice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    {displayed.map(v => <VoiceCard key={v.id} {...cardProps(v)} />)}
                  </div>
                ) : (
                  <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 8 }}>No voices yet</div>
                    <div style={{ fontSize: 14, color: C.textGray, marginBottom: 20 }}>Create your first AI voice to start generating speech.</div>
                    <button onClick={() => onNavigate?.('voice-clone')} style={{ padding: '10px 24px', borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Create Voice</button>
                  </Card>
                )}
              </div>

              {/* Recently Used horizontal row */}
              {recentlyUsed.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>Recently Used</span>
                    <button onClick={() => setCategory('Recently Used')} style={{ fontSize: 12, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                    {recentlyUsed.map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', flexShrink: 0, minWidth: 220 }}>
                        <div aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(v.id), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                          <div style={{ fontSize: 11, color: C.textGray }}>Used {usageByVoice.get(v.id)?.count ?? 0}x</div>
                        </div>
                        <button onClick={() => useVoice(v)} style={{ padding: '6px 12px', borderRadius: 8, background: C.accentLight, color: C.accent, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Generate</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right stats sidebar ──────────────────────────────────────── */}
        <div className="vs-layout-side" style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 16px' }}>Voice Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Total Voices', value: String(voices.length), icon: '🎙' },
                { label: 'Favorites', value: String(favorites.length), icon: '⭐' },
                { label: 'Audio Generated', value: formatHours(totalGeneratedSeconds), icon: '⏱' },
                { label: 'Generations', value: String(history.length), icon: '📈' },
                { label: 'Most Used Voice', value: mostUsed, icon: '🏆' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, color: C.textGray }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 14px' }}>Generation Overview</h3>
            {(['completed', 'failed', 'cancelled'] as const).map(status => {
              const count = history.filter(g => g.status === status).length
              const color = status === 'completed' ? C.green : status === 'failed' ? C.red : C.textGray
              return (
                <div key={status} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: C.textGray, textTransform: 'capitalize' }}>{status}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.black }}>{count}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: C.borderLight }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${history.length > 0 ? (count / history.length) * 100 : 0}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </Card>

          <div style={{ background: C.accentLight, border: `1px solid rgba(100,65,224,0.15)`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Create New Voice</span>
            </div>
            <p style={{ fontSize: 12, color: C.textGray, margin: '0 0 12px', lineHeight: 1.5 }}>Upload audio recordings to clone any voice in minutes.</p>
            <button onClick={() => onNavigate?.('voice-clone')} style={{ width: '100%', padding: '8px 0', borderRadius: 8, background: C.accent, color: C.white, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Get Started</button>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      {renaming && (
        <div role="presentation" onClick={() => !renameBusy && setRenaming(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Edit voice" onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: '0 0 12px' }}>Edit voice</h2>
            <label htmlFor="mv-name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.black, marginBottom: 6 }}>Name</label>
            <input id="mv-name" value={renameDraft} onChange={e => setRenameDraft(e.target.value.slice(0, 80))} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') void submitRename() }}
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.black, outline: 'none', marginBottom: 12 }} />
            <label htmlFor="mv-desc" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.black, marginBottom: 6 }}>Description</label>
            <textarea id="mv-desc" value={descDraft} onChange={e => setDescDraft(e.target.value.slice(0, 300))} rows={3}
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.black, outline: 'none', marginBottom: 16, resize: 'vertical', fontFamily: 'inherit' }} />
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
