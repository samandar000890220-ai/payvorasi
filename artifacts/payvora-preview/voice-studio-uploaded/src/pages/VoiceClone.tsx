import { useState } from 'react'
import { C } from '@/tokens'
import { VoiceCardPlayButton, MiniWaveform, StatusBadge, GenderBadge, SearchBar, Card, Divider } from '@/components/Shared'

type VoiceStatus = 'active' | 'processing' | 'completed' | 'failed' | 'queued'

interface CloneVoice {
  id: string; name: string; label: string; lang: string; accent: string
  gender: string; status: VoiceStatus; duration: string; updated: string
  quality: number; img: string
}

const cloneVoices: CloneVoice[] = [
  { id: 'elon',     name: 'Elon',         label: 'Tech Entrepreneur',   lang: 'English (US)', accent: 'American',  gender: 'Male',    status: 'active',     duration: '45 min',   updated: '2 days ago',  quality: 94, img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'donald',   name: 'Donald',        label: 'Political Speaker',   lang: 'English (US)', accent: 'New York',  gender: 'Male',    status: 'active',     duration: '32 min',   updated: '5 days ago',  quality: 88, img: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'emma',     name: 'Emma',          label: 'British Actress',     lang: 'English (UK)', accent: 'British',   gender: 'Female',  status: 'active',     duration: '28 min',   updated: '1 week ago',  quality: 91, img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'morgan',   name: 'Morgan',        label: 'Documentary Voice',   lang: 'English (US)', accent: 'American',  gender: 'Male',    status: 'active',     duration: '1h 12min', updated: '3 days ago',  quality: 97, img: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'taylor',   name: 'Taylor',        label: 'Pop Artist',          lang: 'English (US)', accent: 'Tennessee', gender: 'Female',  status: 'processing', duration: '18 min',   updated: 'Today',       quality: 72, img: 'https://images.unsplash.com/photo-1699899657680-421c2c2d5064?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'narrator', name: 'Narrator',      label: 'Professional',        lang: 'English (US)', accent: 'Neutral',   gender: 'Male',    status: 'active',     duration: '58 min',   updated: '1 week ago',  quality: 93, img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'podcast',  name: 'Podcast Host',  label: 'Casual Podcast',      lang: 'English (US)', accent: 'Midwest',   gender: 'Male',    status: 'active',     duration: '2h 15min', updated: '4 days ago',  quality: 89, img: 'https://images.unsplash.com/photo-1543132220-3ec99c6094dc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'support',  name: 'Support AI',    label: 'Customer Support',    lang: 'English (US)', accent: 'Neutral',   gender: 'Female',  status: 'active',     duration: '35 min',   updated: '2 weeks ago', quality: 86, img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
]

const TRAINING_STEPS = ['Uploading', 'Analyzing', 'Cleaning Audio', 'Building Voice', 'Training AI', 'Optimizing', 'Completed']

function TrainingProgress({ currentStep }: { currentStep: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {TRAINING_STEPS.map((step, i) => {
        const done = i < currentStep
        const active = i === currentStep
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: done ? C.green : active ? C.accent : C.borderLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {done
                ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <span style={{ fontSize: 9, fontWeight: 600, color: active ? C.white : C.textGray }}>{i + 1}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: done || active ? C.black : C.textGray, lineHeight: '20px' }}>{step}</div>
              {active && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 4, borderRadius: 2, background: C.borderLight, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '65%', background: C.accent, borderRadius: 2, animation: 'progress-pulse 1.5s ease-in-out infinite' }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.textGray, marginTop: 3, display: 'block' }}>Estimated: 4 min remaining</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QualityBar({ value }: { value: number }) {
  const color = value >= 90 ? C.green : value >= 70 ? C.accent : C.orange
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Voice Quality</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.borderLight }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${value}%`, background: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function ActionBtn({ label, icon, primary, danger }: { label: string; icon: React.ReactNode; primary?: boolean; danger?: boolean }) {
  const [h, setH] = useState(false)
  const bg = primary ? (h ? C.accentHover : C.accent) : danger ? (h ? C.redBg : 'transparent') : (h ? C.accentLight : 'transparent')
  const col = primary ? C.white : danger ? (h ? C.red : C.textGray) : (h ? C.accent : C.textGray)
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', borderRadius: 10, border: primary ? 'none' : `1px solid ${C.border}`, background: bg, color: col, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
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

export default function VoiceClone() {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const selectedVoice = cloneVoices.find(v => v.id === selected)

  const filtered = cloneVoices.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>Voice Clone</h1>
          <p style={{ fontSize: 14, color: C.textGray, margin: '4px 0 0' }}>Create realistic AI voice clones from recordings in minutes.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Upload Files', primary: false },
            { label: 'Import Audio', primary: false },
            { label: '+ New Voice',  primary: true  },
          ].map(b => (
            <button key={b.label}
              style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: b.primary ? C.accent : C.white, color: b.primary ? C.white : C.black, border: b.primary ? 'none' : `1px solid ${C.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = b.primary ? C.accentHover : C.accentLight)}
              onMouseLeave={e => (e.currentTarget.style.background = b.primary ? C.accent : C.white)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Left: voice library ──────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search + filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <SearchBar placeholder="Search voices..." value={search} onChange={setSearch} />
            <div style={{ display: 'flex', gap: 4 }}>
              {['All', 'Favorites', 'Recently Used'].map(f => (
                <button key={f}
                  style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${filter === f.toLowerCase() ? C.accent : C.border}`, background: filter === f.toLowerCase() ? C.accentLight : C.white, color: filter === f.toLowerCase() ? C.accent : C.textGray, transition: 'all 0.15s' }}
                  onClick={() => setFilter(f.toLowerCase())}
                >{f}</button>
              ))}
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: C.black, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="11" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="13" y2="18"/></svg>
              Filters
            </button>
          </div>

          {/* Voice grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {/* Create New card */}
            <div
              style={{ borderRadius: 16, border: `1.5px dashed ${C.border}`, background: C.white, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', minHeight: 200, transition: 'all 0.15s', textAlign: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentLight }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>Create New Voice</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 4 }}>
                {['Upload Audio', 'Record Voice', 'Clone URL'].map(opt => (
                  <div key={opt} style={{ fontSize: 12, fontWeight: 500, color: C.accent, background: C.accentLight, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>{opt}</div>
                ))}
              </div>
            </div>

            {/* Voice cards */}
            {filtered.map(v => {
              const isActive = selected === v.id
              return (
                <div
                  key={v.id}
                  onClick={() => setSelected(isActive ? null : v.id)}
                  style={{
                    borderRadius: 16, border: `1px solid ${isActive ? C.accent : C.border}`,
                    background: C.white, padding: 16, cursor: 'pointer', transition: 'all 0.18s',
                    boxShadow: isActive ? `0 0 0 3px rgba(100,65,224,0.10)` : '0 2px 8px rgba(15,23,42,0.04)',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.08)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)' }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <img src={v.img} alt={v.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={e => e.stopPropagation()} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textGray }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      </button>
                      <button onClick={e => e.stopPropagation()} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textGray }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="19" r="1.1" fill="currentColor"/></svg>
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: C.textGray, marginTop: 2, marginBottom: 8 }}>{v.label}</div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    <GenderBadge gender={v.gender} />
                    <StatusBadge status={v.status} />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <MiniWaveform active={isActive} h={24} />
                  </div>

                  <Divider />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.textGray }}>Trained · {v.duration}</div>
                      <div style={{ fontSize: 11, color: C.textGray, marginTop: 1 }}>Updated {v.updated}</div>
                    </div>
                    <VoiceCardPlayButton />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Recent Training table */}
          <div style={{ marginTop: 28 }}>
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 16px' }}>Recent Training Jobs</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Voice', 'Status', 'Progress', 'Created', 'Credits', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.textGray, padding: '0 16px 10px 0', borderBottom: `1px solid ${C.borderLight}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { voice: 'Taylor', status: 'processing' as VoiceStatus, progress: 65, created: 'Today 3:12 PM', credits: 120 },
                    { voice: 'Morgan', status: 'completed'  as VoiceStatus, progress: 100, created: 'Jan 14, 2025',  credits: 240 },
                    { voice: 'Emma',   status: 'completed'  as VoiceStatus, progress: 100, created: 'Jan 10, 2025',  credits: 180 },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '12px 16px 12px 0', fontSize: 14, fontWeight: 500, color: C.black }}>{row.voice}</td>
                      <td style={{ padding: '12px 16px 12px 0' }}><StatusBadge status={row.status} /></td>
                      <td style={{ padding: '12px 16px 12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 3, background: C.borderLight }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${row.progress}%`, background: row.progress === 100 ? C.green : C.accent }} />
                          </div>
                          <span style={{ fontSize: 12, color: C.textGray, minWidth: 30 }}>{row.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px 12px 0', fontSize: 13, color: C.textGray }}>{row.created}</td>
                      <td style={{ padding: '12px 16px 12px 0', fontSize: 13, color: C.textGray }}>{row.credits}</td>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={{ fontSize: 12, fontWeight: 500, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>

        {/* ── Right: details panel ──────────────────────────────────────── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedVoice ? (
            <>
              {/* Voice details */}
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: 16 }}>
                  <img src={selectedVoice.img} alt={selectedVoice.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.black }}>{selectedVoice.name}</div>
                  <div style={{ fontSize: 13, color: C.textGray, marginTop: 3 }}>{selectedVoice.label}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <GenderBadge gender={selectedVoice.gender} />
                    <StatusBadge status={selectedVoice.status} />
                  </div>
                </div>
                <Divider />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
                  {[
                    { label: 'Language',  value: selectedVoice.lang    },
                    { label: 'Accent',    value: selectedVoice.accent  },
                    { label: 'Duration',  value: selectedVoice.duration },
                    { label: 'Updated',   value: selectedVoice.updated },
                    { label: 'Voice ID',  value: selectedVoice.id.toUpperCase() + '-X4K' },
                    { label: 'Model',     value: 'Payvora v2.1'        },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: C.textGray }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <Divider />
                <div style={{ marginTop: 12 }}>
                  <QualityBar value={selectedVoice.quality} />
                </div>

                {selectedVoice.status === 'processing' && (
                  <>
                    <Divider />
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 12 }}>Training Progress</div>
                      <TrainingProgress currentStep={3} />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  <ActionBtn primary label="Play Sample"  icon={<PlayIcon />}    />
                  <ActionBtn label="Edit Voice"   icon={<EditIcon />}    />
                  <ActionBtn label="Retrain"      icon={<RefreshIcon />} />
                  <ActionBtn label="Duplicate"    icon={<CopyIcon />}    />
                  <ActionBtn danger label="Delete Voice"  icon={<TrashIcon />}   />
                </div>
              </Card>
            </>
          ) : (
            <>
              {/* Upload area */}
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 14px' }}>Upload Voice Sample</h3>
                <div style={{
                  border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: '28px 20px',
                  textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentLight }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
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
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 4 }}>Requirements</div>
                  {['Minimum 3 minutes', 'Recommended 15+ minutes', 'Minimal background noise', 'Single speaker only', 'High quality microphone'].map(tip => (
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
    </div>
  )
}
