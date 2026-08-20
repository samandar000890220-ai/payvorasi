import { useState } from 'react'
import { C } from '@/tokens'
import { PlayButton, WaveformIcon, Slider, Toggle, SelectDropdown, VoiceCardPlayButton, SearchBar, FilterPill } from '@/components/Shared'

const voices = [
  { id: 'aria',  name: 'Aria',  gender: 'Female',  desc: 'Warm, energetic, and engaging',        img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'ethan', name: 'Ethan', gender: 'Male',    desc: 'Calm, deep, and professional',          img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'nova',  name: 'Nova',  gender: 'Female',  desc: 'Clear, bright, and friendly',           img: 'https://images.unsplash.com/photo-1699899657680-421c2c2d5064?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'liam',  name: 'Liam',  gender: 'Male',    desc: 'Strong, confident, and authoritative',  img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
  { id: 'sage',  name: 'Sage',  gender: 'Neutral', desc: 'Soft, soothing, and gentle',            img: 'https://images.unsplash.com/photo-1543132220-3ec99c6094dc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200' },
]

const recent = [
  { title: 'Welcome Message',    voice: 'Ethan', time: '11:32 AM',     duration: '00:23', date: 'Today'         },
  { title: 'Product Explainer',  voice: 'Aria',  time: '10:15 AM',     duration: '01:02', date: 'Today'         },
  { title: 'YouTube Intro',      voice: 'Liam',  time: 'Yesterday',    duration: '00:18', date: 'Yesterday'     },
  { title: 'Podcast Episode 12', voice: 'Sage',  time: 'May 14, 2025', duration: '05:45', date: 'May 14, 2025'  },
]

export default function TextToSpeech() {
  const [voiceFilter, setVoiceFilter] = useState('all')
  const [selectedVoice, setSelectedVoice] = useState('ethan')
  const [search, setSearch] = useState('')
  const [text, setText] = useState('Welcome to Payvora AI Voice Studio. Create realistic, expressive speech in seconds. Perfect for videos, podcasts, presentations, and more.')

  const filtered = voices.filter(v =>
    (voiceFilter === 'all' || voiceFilter === 'my-voices') &&
    v.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', gap: 20, padding: '20px 24px 40px' }}>
      {/* ── Left column ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Text input */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Enter your text</h2>
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { label: 'Import Text', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
                { label: 'Clear',       icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> },
              ].map(b => (
                <button key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: C.textGray, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.black)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.textGray)}>
                  {b.icon}{b.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ width: '100%', resize: 'none', fontSize: 14, color: C.black, outline: 'none', lineHeight: 1.6, border: 'none', minHeight: 96, fontFamily: 'inherit', background: 'transparent' }}
            rows={4}
            placeholder="Type or paste your text here..."
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${C.borderLight}`, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: C.textGray }}>{text.length} / 5000</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {[
              { label: 'Add Pause', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg> },
              { label: 'Emphasis',  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
              { label: 'Pronunciation', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
              { label: 'Speaking Style', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
            ].map(b => (
              <button key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: C.accent, background: C.accentLight, border: 'none', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EDE8FA')}
                onMouseLeave={e => (e.currentTarget.style.background = C.accentLight)}>
                {b.icon}{b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Choose a voice */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 16px' }}>Choose a voice</h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all','All Voices'],['favorites','Favorites'],['my-voices','My Voices']].map(([id, label]) => (
                <FilterPill key={id} label={label} active={voiceFilter === id} onClick={() => setVoiceFilter(id)} />
              ))}
            </div>
            <SearchBar placeholder="Search voices..." value={search} onChange={setSearch} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {filtered.map(v => {
              const active = selectedVoice === v.id
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column',
                    borderRadius: 16, padding: '18px 18px 16px',
                    border: active ? `2px solid ${C.accent}` : `1px solid #ECECF3`,
                    background: active ? C.accentLight : C.white,
                    cursor: 'pointer', transition: 'all 0.18s',
                    boxShadow: active
                      ? `0 0 0 3px rgba(100,65,224,0.08), 0 8px 28px -10px rgba(15,23,42,0.06)`
                      : '0 8px 28px -10px rgba(15,23,42,0.06)',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(15,23,42,0.10)' }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 28px -10px rgba(15,23,42,0.06)' }}}
                >
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : '#D7DCE6'} strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={active ? C.accent : 'none'} />
                    </svg>
                  </div>
                  <img src={v.img} alt={v.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }} />
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.black, lineHeight: 1.2 }}>{v.name}</div>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, borderRadius: 20, padding: '2px 8px', marginTop: 4, alignSelf: 'flex-start' }}>{v.gender}</span>
                  <div style={{ fontSize: 13, color: C.textGray, marginTop: 8, lineHeight: 1.5, flex: 1 }}>{v.desc}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <VoiceCardPlayButton />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Generations */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Recent Generations</h2>
            <button style={{ fontSize: 13, fontWeight: 500, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accentHover)}
              onMouseLeave={e => (e.currentTarget.style.color = C.accent)}>View all</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {recent.map((item, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? `1px solid ${C.borderLight}` : undefined }}>
                  <td style={{ padding: '12px 12px 12px 0', width: 44 }}>
                    <PlayButton size={36} />
                  </td>
                  <td style={{ padding: '12px 20px 12px 0' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.black }}>{item.title}</span>
                  </td>
                  <td style={{ padding: '12px 20px 12px 0', fontSize: 13, color: C.textGray, whiteSpace: 'nowrap' }}>{item.voice} · {item.time}</td>
                  <td style={{ padding: '12px 20px 12px 0', fontSize: 13, color: C.textGray, fontFamily: 'monospace' }}>{item.duration}</td>
                  <td style={{ padding: '12px 20px 12px 0', fontSize: 13, color: C.textGray, whiteSpace: 'nowrap' }}>{item.date}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {[
                        <svg key="dl" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
                        <svg key="more" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>,
                      ].map((icon, j) => (
                        <button key={j} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textGray, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.accent }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textGray }}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 20px' }}>Voice Settings</h2>

          <p style={{ fontSize: 12, color: C.textGray, margin: '0 0 8px' }}>Selected Voice</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200" alt="Ethan" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>Ethan</div>
                <div style={{ fontSize: 12, color: C.textGray }}>English (US)</div>
              </div>
            </div>
            <button style={{ fontSize: 12, fontWeight: 500, color: C.black, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', background: C.white, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}>Change</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {[{ label: 'Speed', v: 50, d: '1.0x' }, { label: 'Pitch', v: 50, d: '0%' }, { label: 'Stability', v: 75, d: '75%' }, { label: 'Similarity', v: 85, d: '85%' }].map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: C.textGray }}>{s.d}</span>
                </div>
                <Slider value={s.v} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {[{ label: 'Speaking Style', v: 'General' }, { label: 'Role', v: 'Default' }].map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{d.label}</span>
                <SelectDropdown value={d.v} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>Add natural pauses</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textGray} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <Toggle checked={true} />
              </div>
            </div>
          </div>

          <button
            style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
          >
            <WaveformIcon size={16} color={C.white} />
            Generate Speech
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: C.textGray, margin: '8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            This will use 23 credits
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textGray} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </p>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          {[{ label: 'Output Format', v: 'MP3' }, { label: 'Sample Rate', v: '24kHz' }].map((d, i) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0, borderTop: i > 0 ? `1px solid ${C.borderLight}` : undefined }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{d.label}</span>
              <SelectDropdown value={d.v} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
