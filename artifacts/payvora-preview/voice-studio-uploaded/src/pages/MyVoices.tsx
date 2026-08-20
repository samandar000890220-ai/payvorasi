import { useState } from 'react'
import { C } from '@/tokens'
import { VoiceCardPlayButton, GenderBadge, SearchBar, Card, Divider } from '@/components/Shared'

interface MyVoice {
  id: string; name: string; desc: string; lang: string; accent: string
  gender: string; quality: 'Premium' | 'Standard' | 'Basic'; created: string
  usage: number; duration: string; favorite: boolean; img: string
}

const myVoices: MyVoice[] = [
  { id: 'ethan',   name: 'Ethan',    desc: 'Professional English narrator',    lang: 'English (US)', accent: 'American', gender: 'Male',    quality: 'Premium',  created: 'Jan 15, 2025', usage: 48,  duration: '2h 14m', favorite: true,  img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'emma',    name: 'Emma',     desc: 'Friendly customer support voice',  lang: 'English (US)', accent: 'British',  gender: 'Female',  quality: 'Premium',  created: 'Jan 20, 2025', usage: 31,  duration: '58m',    favorite: true,  img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'sophia',  name: 'Sophia',   desc: 'Natural female narration',         lang: 'English (US)', accent: 'Neutral',  gender: 'Female',  quality: 'Standard', created: 'Feb 1, 2025',  usage: 17,  duration: '44m',    favorite: false, img: 'https://images.unsplash.com/photo-1699899657680-421c2c2d5064?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'michael', name: 'Michael',  desc: 'Deep documentary narrator',        lang: 'English (US)', accent: 'American', gender: 'Male',    quality: 'Premium',  created: 'Feb 5, 2025',  usage: 62,  duration: '3h 02m', favorite: true,  img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'david',   name: 'David',    desc: 'Energetic podcast host',           lang: 'English (US)', accent: 'Midwest',  gender: 'Male',    quality: 'Standard', created: 'Feb 8, 2025',  usage: 24,  duration: '1h 18m', favorite: false, img: 'https://images.unsplash.com/photo-1543132220-3ec99c6094dc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'elena',   name: 'Elena',    desc: 'Warm audiobook narrator',          lang: 'English (UK)', accent: 'British',  gender: 'Female',  quality: 'Premium',  created: 'Feb 12, 2025', usage: 39,  duration: '2h 47m', favorite: true,  img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'alex',    name: 'Alex',     desc: 'Corporate presentation voice',     lang: 'English (US)', accent: 'American', gender: 'Neutral', quality: 'Standard', created: 'Mar 1, 2025',  usage: 11,  duration: '29m',    favorite: false, img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
  { id: 'grace',   name: 'Grace',    desc: 'Calming meditation guide',         lang: 'English (US)', accent: 'Neutral',  gender: 'Female',  quality: 'Basic',    created: 'Mar 10, 2025', usage: 6,   duration: '14m',    favorite: false, img: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=300&h=300' },
]

const CATEGORIES = ['All', 'Favorites', 'Recently Used', 'Professional', 'Narration', 'Podcast', 'Character', 'Music', 'Custom']

const qualityColor: Record<string, string> = { Premium: C.accent, Standard: C.orange, Basic: C.textGray }

function VoiceCard({ v, onUse }: { v: MyVoice; onUse: () => void }) {
  const [fav, setFav] = useState(v.favorite)
  return (
    <div
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', transition: 'all 0.18s', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,23,42,0.09)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)' }}
    >
      {/* Photo + fav star */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <img src={v.img} alt={v.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 12 }} />
        <button
          onClick={() => setFav(!fav)}
          style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'transform 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={fav ? '#F59E0B' : 'none'} stroke={fav ? '#F59E0B' : C.textGray} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, fontWeight: 600, color: qualityColor[v.quality], background: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: '2px 7px', backdropFilter: 'blur(4px)' }}>{v.quality}</span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 4 }}>{v.name}</div>
      <div style={{ fontSize: 13, color: C.textGray, marginBottom: 10, lineHeight: 1.4 }}>{v.desc}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        <GenderBadge gender={v.gender} />
        <span style={{ fontSize: 11, fontWeight: 500, color: C.textGray, background: C.borderLight, borderRadius: 20, padding: '2px 8px' }}>{v.accent}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.textGray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Used</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{v.usage}x</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textGray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Generated</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{v.duration}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textGray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Created</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.black }}>{v.created}</div>
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
          {[
            { title: 'Preview',   icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
            { title: 'Edit',      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
            { title: 'Duplicate', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
            { title: 'Download',  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
            { title: 'Delete',    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> },
          ].map(btn => (
            <button key={btn.title} title={btn.title} style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textGray, transition: 'all 0.15s' }}
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

export default function MyVoices() {
  const [category, setCategory] = useState('All')
  const [search, setSearch]     = useState('')

  const favorites = myVoices.filter(v => v.favorite)
  const displayed = myVoices.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase()) || v.desc.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || (category === 'Favorites' && v.favorite) || category === 'Recently Used'
    return matchSearch && matchCat
  })
  const recentlyUsed = [...myVoices].sort((a, b) => b.usage - a.usage).slice(0, 4)

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>My Voices</h1>
          <p style={{ fontSize: 14, color: C.textGray, margin: '4px 0 0' }}>Manage all of your custom AI voices in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.white, color: C.black, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>Import Voice</button>
          <button style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: C.accent, color: C.white, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = C.accent)}>+ Create Voice</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search + category filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <SearchBar placeholder="Search voices..." value={search} onChange={setSearch} />
            <div style={{ display: 'flex', gap: 2, background: C.borderLight, borderRadius: 12, padding: 4, flexShrink: 0, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat}
                  onClick={() => setCategory(cat)}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: category === cat ? C.white : 'transparent', color: category === cat ? C.black : C.textGray, boxShadow: category === cat ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
                >{cat}</button>
              ))}
            </div>
          </div>

          {/* Favorites pinned row */}
          {(category === 'All' || category === 'Favorites') && favorites.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>Favorites</span>
                <span style={{ fontSize: 12, color: C.textGray }}>({favorites.length})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {favorites.map(v => <VoiceCard key={v.id} v={v} onUse={() => {}} />)}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {displayed.map(v => <VoiceCard key={v.id} v={v} onUse={() => {}} />)}
              </div>
            ) : (
              <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 8 }}>No voices yet</div>
                <div style={{ fontSize: 14, color: C.textGray, marginBottom: 20 }}>Create your first AI voice to start generating speech.</div>
                <button style={{ padding: '10px 24px', borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Create Voice</button>
              </Card>
            )}
          </div>

          {/* Recently Used horizontal row */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>Recently Used</span>
              <button style={{ fontSize: 12, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {recentlyUsed.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', flexShrink: 0, minWidth: 220 }}>
                  <img src={v.img} alt={v.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: C.textGray }}>Used {v.usage}x</div>
                  </div>
                  <button style={{ padding: '6px 12px', borderRadius: 8, background: C.accentLight, color: C.accent, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Generate</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right stats sidebar ──────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 16px' }}>Voice Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Total Voices',     value: String(myVoices.length),  icon: '🎙' },
                { label: 'Favorites',         value: String(favorites.length), icon: '⭐' },
                { label: 'Hours Generated',   value: '14h 22m',               icon: '⏱' },
                { label: 'Most Used Voice',   value: 'Michael',               icon: '🏆' },
                { label: 'Storage Used',      value: '2.4 GB',                icon: '💾' },
                { label: 'Monthly Usage',     value: '1,240',                 icon: '📈' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, color: C.textGray }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 14px' }}>Quality Overview</h3>
            {[
              { label: 'Premium', count: myVoices.filter(v => v.quality === 'Premium').length,  color: C.accent },
              { label: 'Standard', count: myVoices.filter(v => v.quality === 'Standard').length, color: C.orange },
              { label: 'Basic', count: myVoices.filter(v => v.quality === 'Basic').length,     color: C.textGray },
            ].map(q => (
              <div key={q.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: C.textGray }}>{q.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.black }}>{q.count} voices</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.borderLight }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${(q.count / myVoices.length) * 100}%`, background: q.color }} />
                </div>
              </div>
            ))}
          </Card>

          <div style={{ background: C.accentLight, border: `1px solid rgba(100,65,224,0.15)`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Create New Voice</span>
            </div>
            <p style={{ fontSize: 12, color: C.textGray, margin: '0 0 12px', lineHeight: 1.5 }}>Upload audio recordings to clone any voice in minutes.</p>
            <button style={{ width: '100%', padding: '8px 0', borderRadius: 8, background: C.accent, color: C.white, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Get Started</button>
          </div>

        </div>
      </div>
    </div>
  )
}
