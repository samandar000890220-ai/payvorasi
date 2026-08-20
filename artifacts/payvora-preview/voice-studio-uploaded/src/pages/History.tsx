import { useState } from 'react'
import { C } from '@/tokens'
import { PlayButton, MiniWaveform, StatusBadge, SearchBar, Card, Divider } from '@/components/Shared'

type HistStatus = 'completed' | 'processing' | 'failed' | 'queued'

interface HistItem {
  id: string; title: string; voice: string; voiceImg: string; lang: string
  duration: string; created: string; credits: number; status: HistStatus; tags: string[]
}

const todayItems: HistItem[] = [
  { id: 'h1', title: 'Product Demo',        voice: 'Ethan',   voiceImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '01:24', created: 'Today · 2:31 PM',  credits: 24,  status: 'completed',  tags: ['product', 'demo']     },
  { id: 'h2', title: 'Welcome Message',     voice: 'Aria',    voiceImg: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '00:34', created: 'Today · 11:44 AM', credits: 12,  status: 'completed',  tags: ['onboarding']          },
  { id: 'h3', title: 'Support FAQ Audio',   voice: 'Nova',    voiceImg: 'https://images.unsplash.com/photo-1699899657680-421c2c2d5064?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '03:12', created: 'Today · 9:05 AM',  credits: 58,  status: 'processing', tags: ['support', 'faq']      },
]

const yesterdayItems: HistItem[] = [
  { id: 'h4', title: 'YouTube Intro',       voice: 'Liam',    voiceImg: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '00:18', created: 'Yesterday · 4:12 PM', credits: 6,   status: 'completed',  tags: ['youtube']             },
  { id: 'h5', title: 'Explainer Video',     voice: 'Sage',    voiceImg: 'https://images.unsplash.com/photo-1543132220-3ec99c6094dc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '02:45', created: 'Yesterday · 1:30 PM', credits: 50,  status: 'completed',  tags: ['video', 'explainer']  },
  { id: 'h6', title: 'Error Batch Job',     voice: 'Ethan',   voiceImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '--',    created: 'Yesterday · 9:00 AM', credits: 0,   status: 'failed',     tags: []                      },
]

const olderItems: HistItem[] = [
  { id: 'h7', title: 'Podcast Episode 12',  voice: 'Sage',    voiceImg: 'https://images.unsplash.com/photo-1543132220-3ec99c6094dc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '05:45', created: 'May 14 · 10:00 AM',  credits: 104, status: 'completed',  tags: ['podcast']             },
  { id: 'h8', title: 'Ad Campaign Voice',   voice: 'Aria',    voiceImg: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=100&h=100', lang: 'English (US)', duration: '00:52', created: 'May 12 · 3:15 PM',   credits: 18,  status: 'completed',  tags: ['ads', 'marketing']    },
]

const statCards = [
  { label: "Today's Generations", value: '28',     sub: '+12% vs yesterday', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
  { label: 'Hours Generated',      value: '4h 52m', sub: 'This month: 84h',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { label: 'Credits Used',         value: '438',    sub: '1,562 remaining',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
  { label: 'Successful Jobs',       value: '99.8%',  sub: '1 failed today',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
  { label: 'Average Quality',       value: '4.9★',   sub: 'Excellent',         icon: <svg width="18" height="18" viewBox="0 0 24 24" fill={C.orange} stroke={C.orange} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
]

function HistoryCard({ item, selected, onClick }: { item: HistItem; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
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
        {/* Play button */}
        <div onClick={e => e.stopPropagation()}>
          <PlayButton size={40} />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.black, marginBottom: 4 }}>{item.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: C.textGray, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img src={item.voiceImg} alt={item.voice} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                  {item.voice}
                </span>
                <span>· {item.lang}</span>
                <span style={{ fontFamily: 'monospace' }}>· {item.duration}</span>
                <span>· {item.credits} credits</span>
                <span>· {item.created}</span>
              </div>
              {/* Waveform preview */}
              <div style={{ width: '100%', maxWidth: 280 }}>
                <MiniWaveform active={selected} h={22} />
              </div>
              {/* Tags */}
              {item.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {item.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 11, fontWeight: 500, color: C.textGray, background: C.borderLight, borderRadius: 6, padding: '2px 8px' }}>#{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <StatusBadge status={item.status} />
              <div style={{ display: 'flex', gap: 4, opacity: 0 }} className="card-actions">
                {['Replay', 'Download', 'Share', 'Delete'].map(a => (
                  <button key={a} onClick={e => e.stopPropagation()} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: a === 'Delete' ? C.red : C.textGray, cursor: 'pointer' }}>{a}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineSection({ title, items, selectedId, onSelect }: { title: string; items: HistItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>{title}</span>
        <span style={{ fontSize: 12, color: C.textGray }}>({items.length})</span>
        <div style={{ flex: 1, height: 1, background: C.borderLight }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <HistoryCard key={item.id} item={item} selected={selectedId === item.id} onClick={() => onSelect(item.id)} />
        ))}
      </div>
    </div>
  )
}

export default function History() {
  const [selected, setSelected]   = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [voiceFilter, setVoiceFilter] = useState('All')

  const allItems = [...todayItems, ...yesterdayItems, ...olderItems]
  const selectedItem = allItems.find(i => i.id === selected)

  const filterItems = (items: HistItem[]) =>
    items.filter(i =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.voice.toLowerCase().includes(search.toLowerCase()) ||
      i.tags.some(t => t.includes(search.toLowerCase()))
    )

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>History</h1>
          <p style={{ fontSize: 14, color: C.textGray, margin: '4px 0 0' }}>View, search, replay, download, and manage every AI generation.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Sort', plain: true },
            { label: 'Export', plain: true },
          ].map(b => (
            <button key={b.label}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: C.black, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
        {statCards.map(s => (
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <SearchBar placeholder="Search history by title, voice, or tag..." value={search} onChange={setSearch} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Completed', 'Processing', 'Failed'].map(f => (
            <button key={f}
              onClick={() => setVoiceFilter(f)}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${voiceFilter === f ? C.accent : C.border}`, background: voiceFilter === f ? C.accentLight : C.white, color: voiceFilter === f ? C.accent : C.textGray, transition: 'all 0.15s' }}
            >{f}</button>
          ))}
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: C.textGray, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Date Range
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Timeline ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <TimelineSection title="Today"          items={filterItems(todayItems)}     selectedId={selected} onSelect={id => setSelected(id === selected ? null : id)} />
          <TimelineSection title="Yesterday"      items={filterItems(yesterdayItems)} selectedId={selected} onSelect={id => setSelected(id === selected ? null : id)} />
          <TimelineSection title="Earlier"        items={filterItems(olderItems)}     selectedId={selected} onSelect={id => setSelected(id === selected ? null : id)} />
        </div>

        {/* ── Details panel ────────────────────────────────────────────── */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {selectedItem ? (
            <Card style={{ position: 'sticky', top: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <img src={selectedItem.voiceImg} alt={selectedItem.voice} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.black }}>{selectedItem.title}</div>
                  <div style={{ fontSize: 13, color: C.textGray }}>Voice: {selectedItem.voice}</div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <MiniWaveform active h={36} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: C.accent, color: C.white, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  ▶ Replay
                </button>
                <button style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: C.white, color: C.black, fontSize: 13, fontWeight: 600, border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  ↓ Download
                </button>
              </div>

              <Divider />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
                {[
                  { label: 'Language',   value: selectedItem.lang },
                  { label: 'Duration',   value: selectedItem.duration },
                  { label: 'Created',    value: selectedItem.created },
                  { label: 'Credits',    value: `${selectedItem.credits} credits` },
                  { label: 'Status',     value: selectedItem.status },
                  { label: 'Output',     value: 'MP3 · 24kHz' },
                  { label: 'Model',      value: 'Payvora v2.1' },
                  { label: 'Speed',      value: '1.0x' },
                  { label: 'Stability',  value: '75%' },
                  { label: 'Similarity', value: '85%' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: C.textGray }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <Divider />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {[
                  { label: 'Duplicate',      icon: '⧉' },
                  { label: 'Share',          icon: '↗' },
                  { label: 'Move to Folder', icon: '📁' },
                  { label: 'Delete',         icon: '🗑', danger: true },
                ].map(b => (
                  <button key={b.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: `1px solid ${b.danger ? 'transparent' : C.border}`, background: b.danger ? C.redBg : C.white, color: b.danger ? C.red : C.textGray, fontSize: 13, fontWeight: 500, cursor: 'pointer', width: '100%', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!b.danger) { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.accent }}}
                    onMouseLeave={e => { if (!b.danger) { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textGray }}}
                  >
                    <span>{b.icon}</span>{b.label}
                  </button>
                ))}
              </div>
            </Card>
          ) : (
            <Card style={{ textAlign: 'center', padding: '40px 20px', position: 'sticky', top: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: C.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textGray} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>Select a generation</div>
              <div style={{ fontSize: 13, color: C.textGray, lineHeight: 1.5 }}>Click any history item to view details, replay audio, and manage settings.</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
