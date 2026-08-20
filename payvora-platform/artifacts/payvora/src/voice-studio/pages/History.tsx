import { useCallback, useEffect, useMemo, useState } from 'react'
import { C } from '../tokens'
import { PlayButton, MiniWaveform, StatusBadge, SearchBar, Card, Divider, ConfirmDialog } from '../components/Shared'
import {
  listHistory, deleteHistoryItem, updateHistoryItem, generationAudioUrl, generateVoice,
  type GenerationRecord,
} from '../api'
import { audioManager, useAudioState } from '../audioManager'

const AVATAR_COLORS = ['#6441E0', '#0EA5E9', '#F97316', '#10B981', '#EC4899', '#8B5CF6']
const avatarColor = (id: string) => AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

const STATUS_FILTERS = ['All', 'Completed', 'Processing', 'Failed']
type SortMode = 'newest' | 'oldest' | 'title'
type DateRange = 'all' | '7d' | '30d'

function formatDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return '--:--'
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatCreated(iso: string): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d >= today) return `Today · ${time}`
  if (d >= yesterday) return `Yesterday · ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${time}`
}

function formatHours(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600), m = Math.round((totalSeconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function settingsSummary(settings: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (typeof settings.speed === 'number') rows.push({ label: 'Speed', value: `${settings.speed}x` })
  if (typeof settings.pitch === 'number') rows.push({ label: 'Pitch', value: `${Number(settings.pitch) > 0 ? '+' : ''}${settings.pitch}` })
  if (typeof settings.emotion === 'string' && settings.emotion) rows.push({ label: 'Style', value: String(settings.emotion) })
  return rows
}

function playStateFor(audio: ReturnType<typeof useAudioState>, id: string): 'idle' | 'loading' | 'playing' | 'paused' {
  if (audio.trackId === `hist-${id}`) {
    if (audio.status === 'playing') return 'playing'
    if (audio.status === 'loading') return 'loading'
    if (audio.status === 'paused') return 'paused'
  }
  return 'idle'
}

function HistoryCard({ item, selected, onClick, onPlay, onFavorite, playState }: {
  item: GenerationRecord; selected: boolean; onClick: () => void
  onPlay: () => void; onFavorite: () => void
  playState: 'idle' | 'loading' | 'playing' | 'paused'
}) {
  return (
    <div
      onClick={onClick}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        background: C.white, borderRadius: 16, padding: 20, cursor: 'pointer',
        border: `1px solid ${selected ? C.accent : C.border}`,
        boxShadow: selected ? `0 0 0 3px rgba(100,65,224,0.08)` : 'none',
        transition: 'all 0.18s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.08)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div onClick={e => e.stopPropagation()}>
          <PlayButton size={40} state={item.status === 'completed' ? playState : 'idle'} onClick={onPlay} label={`Play ${item.title}`} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.black, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                <button onClick={e => { e.stopPropagation(); onFavorite() }}
                  aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={item.favorite}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={item.favorite ? '#F59E0B' : 'none'} stroke={item.favorite ? '#F59E0B' : '#D7DCE6'} strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: C.textGray, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', background: avatarColor(item.voiceId ?? item.voiceName), color: C.white, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>
                    {item.voiceName.charAt(0).toUpperCase()}
                  </span>
                  {item.voiceName}
                </span>
                <span style={{ fontFamily: 'monospace' }}>· {formatDuration(item.durationSeconds)}</span>
                <span>· {formatCreated(item.createdAt)}</span>
              </div>
              <div style={{ width: '100%', maxWidth: 280 }}>
                <MiniWaveform active={selected || playState === 'playing'} h={22} />
              </div>
              {item.status === 'failed' && item.error && (
                <div style={{ fontSize: 12, color: C.red, marginTop: 8, lineHeight: 1.4 }}>{item.error}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <StatusBadge status={item.status === 'cancelled' ? 'failed' : item.status} />
              {item.status === 'cancelled' && <span style={{ fontSize: 11, color: C.textGray }}>Cancelled</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineSection({ title, items, selectedId, onSelect, onPlay, onFavorite, audio }: {
  title: string; items: GenerationRecord[]; selectedId: string | null
  onSelect: (id: string) => void; onPlay: (item: GenerationRecord) => void; onFavorite: (item: GenerationRecord) => void
  audio: ReturnType<typeof useAudioState>
}) {
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>{title}</span>
        <span style={{ fontSize: 12, color: C.textGray }}>({items.length})</span>
        <div style={{ flex: 1, height: 1, background: C.borderLight }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <HistoryCard key={item.id} item={item} selected={selectedId === item.id}
            playState={playStateFor(audio, item.id)}
            onClick={() => onSelect(item.id)} onPlay={() => onPlay(item)} onFavorite={() => onFavorite(item)} />
        ))}
      </div>
    </div>
  )
}

export default function History({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [items, setItems] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GenerationRecord | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [retryBusy, setRetryBusy] = useState(false)
  const audio = useAudioState()

  const refresh = useCallback(async () => {
    try {
      setLoadError(null)
      setItems(await listHistory())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const selectedItem = items.find(i => i.id === selected) ?? null

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff = dateRange === '7d' ? now - 7 * 864e5 : dateRange === '30d' ? now - 30 * 864e5 : 0
    const list = items.filter(i => {
      const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
        i.voiceName.toLowerCase().includes(search.toLowerCase()) ||
        i.text.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'All' ||
        (statusFilter === 'Completed' && i.status === 'completed') ||
        (statusFilter === 'Processing' && (i.status === 'processing' || i.status === 'queued')) ||
        (statusFilter === 'Failed' && (i.status === 'failed' || i.status === 'cancelled'))
      const matchDate = cutoff === 0 || new Date(i.createdAt).getTime() >= cutoff
      return matchSearch && matchStatus && matchDate
    })
    return [...list].sort((a, b) =>
      sortMode === 'title' ? a.title.localeCompare(b.title)
        : sortMode === 'oldest' ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt))
  }, [items, search, statusFilter, dateRange, sortMode])

  const { todayItems, yesterdayItems, olderItems } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const t: GenerationRecord[] = [], y: GenerationRecord[] = [], o: GenerationRecord[] = []
    for (const i of filtered) {
      const d = new Date(i.createdAt)
      if (d >= today) t.push(i)
      else if (d >= yesterday) y.push(i)
      else o.push(i)
    }
    return { todayItems: t, yesterdayItems: y, olderItems: o }
  }, [filtered])

  // Real stats
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayCount = items.filter(i => new Date(i.createdAt) >= today).length
    const totalSeconds = items.reduce((a, i) => a + (i.durationSeconds ?? 0), 0)
    const completed = items.filter(i => i.status === 'completed').length
    const failed = items.filter(i => i.status === 'failed').length
    const successRate = items.length > 0 ? Math.round((completed / items.length) * 100) : 0
    return [
      { label: "Today's Generations", value: String(todayCount), sub: `${items.length} total`, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
      { label: 'Audio Generated', value: formatHours(totalSeconds), sub: 'All time', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
      { label: 'Completed', value: String(completed), sub: `${items.length} attempted`, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
      { label: 'Success Rate', value: items.length > 0 ? `${successRate}%` : '—', sub: `${failed} failed`, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
      { label: 'Favorites', value: String(items.filter(i => i.favorite).length), sub: 'Starred items', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill={C.orange} stroke={C.orange} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
    ]
  }, [items])

  // ── Actions ──────────────────────────────────────────────────────────────
  const playItem = (item: GenerationRecord) => {
    if (item.status !== 'completed') { setNotice(item.error ?? 'That generation has no audio to play.'); return }
    void audioManager.toggle(`hist-${item.id}`, generationAudioUrl(item.id))
  }

  const downloadItem = (item: GenerationRecord) => {
    if (item.status !== 'completed') { setNotice('Only completed generations can be downloaded.'); return }
    const a = document.createElement('a')
    a.href = generationAudioUrl(item.id, { download: true })
    a.download = ''
    document.body.appendChild(a); a.click(); a.remove()
  }

  const toggleFavorite = async (item: GenerationRecord) => {
    setItems(list => list.map(i => i.id === item.id ? { ...i, favorite: !i.favorite } : i))
    try { await updateHistoryItem(item.id, { favorite: !item.favorite }) }
    catch { setItems(list => list.map(i => i.id === item.id ? { ...i, favorite: item.favorite } : i)); setNotice('Could not update favorite.') }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await deleteHistoryItem(deleteTarget.id)
      if (audio.trackId === `hist-${deleteTarget.id}`) audioManager.stop()
      if (selected === deleteTarget.id) setSelected(null)
      setItems(list => list.filter(i => i.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Delete failed.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const retryItem = async (item: GenerationRecord) => {
    if (retryBusy) return
    if (!item.voiceId) { setNotice('This generation has no associated voice — pick a voice in Voice Studio and regenerate.'); return }
    setRetryBusy(true)
    try {
      await generateVoice(item.voiceId, item.text, item.settings, item.title)
      await refresh()
      setNotice('Regeneration queued — it will appear at the top when finished.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Retry failed.')
    } finally {
      setRetryBusy(false)
    }
  }

  const exportHistory = () => {
    if (items.length === 0) { setNotice('Nothing to export yet.'); return }
    const rows = [
      ['Title', 'Voice', 'Status', 'Duration (s)', 'Created', 'Text'],
      ...items.map(i => [i.title, i.voiceName, i.status, String(i.durationSeconds ?? ''), i.createdAt, i.text.replace(/\s+/g, ' ')]),
    ]
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'payvora-history.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(a.href)
  }

  const cycleSort = () => setSortMode(m => m === 'newest' ? 'oldest' : m === 'oldest' ? 'title' : 'newest')
  const cycleDateRange = () => setDateRange(r => r === 'all' ? '7d' : r === '7d' ? '30d' : 'all')
  const sortLabel = sortMode === 'newest' ? 'Sort: Newest' : sortMode === 'oldest' ? 'Sort: Oldest' : 'Sort: Title'
  const dateLabel = dateRange === 'all' ? 'Date Range: All' : dateRange === '7d' ? 'Last 7 days' : 'Last 30 days'

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>History</h1>
          <p style={{ fontSize: 14, color: C.textGray, margin: '4px 0 0' }}>View, search, replay, download, and manage every AI generation.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={cycleSort}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: C.black, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>{sortLabel}</button>
          <button onClick={exportHistory}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: C.black, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>Export</button>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ marginBottom: 16, fontSize: 13, color: C.accent, background: C.accentLight, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0 }}>×</button>
        </div>
      )}

      {/* Stats row */}
      <div className="hist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.textGray, fontWeight: 500 }}>{s.label}</span>
              {s.icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.black, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textGray, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="hist-search-row" style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchBar placeholder="Search history by title, voice, or text..." value={search} onChange={setSearch} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f}
              onClick={() => setStatusFilter(f)}
              aria-pressed={statusFilter === f}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${statusFilter === f ? C.accent : C.border}`, background: statusFilter === f ? C.accentLight : C.white, color: statusFilter === f ? C.accent : C.textGray, transition: 'all 0.15s' }}
            >{f}</button>
          ))}
        </div>
        <button onClick={cycleDateRange}
          aria-pressed={dateRange !== 'all'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: `1px solid ${dateRange !== 'all' ? C.accent : C.border}`, background: dateRange !== 'all' ? C.accentLight : C.white, color: dateRange !== 'all' ? C.accent : C.textGray, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {dateLabel}
        </button>
      </div>

      <div className="vs-two-col" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Timeline ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: C.textGray }}>Loading history…</p>
          ) : loadError ? (
            <div role="alert" style={{ fontSize: 13, color: C.red, display: 'flex', gap: 12, alignItems: 'center' }}>
              {loadError}
              <button onClick={() => { setLoading(true); void refresh() }} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: C.accentLight, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>
                {items.length === 0 ? 'No generations yet' : 'Nothing matches those filters'}
              </div>
              <div style={{ fontSize: 13, color: C.textGray, marginBottom: items.length === 0 ? 16 : 0 }}>
                {items.length === 0 ? 'Generate speech in Voice Studio and it will show up here.' : 'Try clearing the search or filters.'}
              </div>
              {items.length === 0 && (
                <button onClick={() => onNavigate?.('text-to-speech')} style={{ padding: '9px 20px', borderRadius: 10, background: C.accent, color: C.white, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Open Voice Studio</button>
              )}
            </Card>
          ) : (
            <>
              <TimelineSection title="Today" items={todayItems} selectedId={selected} onSelect={id => setSelected(id === selected ? null : id)} onPlay={playItem} onFavorite={i => void toggleFavorite(i)} audio={audio} />
              <TimelineSection title="Yesterday" items={yesterdayItems} selectedId={selected} onSelect={id => setSelected(id === selected ? null : id)} onPlay={playItem} onFavorite={i => void toggleFavorite(i)} audio={audio} />
              <TimelineSection title="Earlier" items={olderItems} selectedId={selected} onSelect={id => setSelected(id === selected ? null : id)} onPlay={playItem} onFavorite={i => void toggleFavorite(i)} audio={audio} />
            </>
          )}
        </div>

        {/* ── Details panel ────────────────────────────────────────────── */}
        <div className="hist-details-panel" style={{ width: 300, flexShrink: 0 }}>
          {selectedItem ? (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div aria-hidden style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor(selectedItem.voiceId ?? selectedItem.voiceName), color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
                  {selectedItem.voiceName.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedItem.title}</div>
                  <div style={{ fontSize: 13, color: C.textGray }}>Voice: {selectedItem.voiceName}</div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <MiniWaveform active h={36} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => playItem(selectedItem)} disabled={selectedItem.status !== 'completed'}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: C.accent, color: C.white, fontSize: 13, fontWeight: 600, border: 'none', cursor: selectedItem.status === 'completed' ? 'pointer' : 'not-allowed', opacity: selectedItem.status === 'completed' ? 1 : 0.5 }}>
                  {playStateFor(audio, selectedItem.id) === 'playing' ? '❚❚ Pause' : '▶ Replay'}
                </button>
                <button onClick={() => downloadItem(selectedItem)} disabled={selectedItem.status !== 'completed'}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: C.white, color: C.black, fontSize: 13, fontWeight: 600, border: `1px solid ${C.border}`, cursor: selectedItem.status === 'completed' ? 'pointer' : 'not-allowed', opacity: selectedItem.status === 'completed' ? 1 : 0.5 }}>
                  ↓ Download
                </button>
              </div>

              <Divider />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
                {[
                  { label: 'Duration', value: formatDuration(selectedItem.durationSeconds) },
                  { label: 'Created', value: formatCreated(selectedItem.createdAt) },
                  { label: 'Status', value: selectedItem.status },
                  { label: 'Engine', value: 'F5-TTS' },
                  ...settingsSummary(selectedItem.settings),
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: C.textGray }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.black, textTransform: row.label === 'Status' ? 'capitalize' : undefined }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <Divider />

              <div style={{ margin: '12px 0' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 6 }}>Text</div>
                <div style={{ fontSize: 12, color: C.textGray, lineHeight: 1.5, maxHeight: 96, overflowY: 'auto' }}>{selectedItem.text}</div>
              </div>

              <Divider />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button onClick={() => void retryItem(selectedItem)} disabled={retryBusy}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.textGray, fontSize: 13, fontWeight: 500, cursor: retryBusy ? 'wait' : 'pointer', width: '100%', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.accent }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textGray }}>
                  <span>⟳</span>{retryBusy ? 'Queuing…' : 'Regenerate'}
                </button>
                <button disabled title="Public share links are not available yet — download the audio and share the file instead."
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.textGray, fontSize: 13, fontWeight: 500, cursor: 'not-allowed', width: '100%', opacity: 0.5 }}>
                  <span>↗</span>Share (unavailable)
                </button>
                <button onClick={() => setDeleteTarget(selectedItem)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: '1px solid transparent', background: C.redBg, color: C.red, fontSize: 13, fontWeight: 500, cursor: 'pointer', width: '100%' }}>
                  <span>🗑</span>Delete
                </button>
              </div>
            </Card>
          ) : (
            <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: C.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textGray} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>Select a generation</div>
              <div style={{ fontSize: 13, color: C.textGray, lineHeight: 1.5 }}>Click any history item to view details, replay audio, and manage settings.</div>
            </Card>
          )}
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
