import { useState } from 'react'
import { C } from '@/tokens'
import { WaveformIcon } from '@/components/Shared'
import TextToSpeech from '@/pages/TextToSpeech'
import VoiceClone   from '@/pages/VoiceClone'
import MyVoices     from '@/pages/MyVoices'
import History      from '@/pages/History'

const TABS = [
  { id: 'text-to-speech', label: 'Text to Speech' },
  { id: 'voice-clone',    label: 'Voice Clone'    },
  { id: 'my-voices',      label: 'My Voices'      },
  { id: 'history',        label: 'History'        },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('text-to-speech')

  return (
    <div style={{ minHeight: '100vh', background: C.white, fontFamily: 'Inter, system-ui, sans-serif', color: C.black }}>

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #F0A050', color: '#E08020', borderRadius: 20, padding: '7px 16px', fontSize: 13, fontWeight: 500, background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FFF7ED')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Upgrade
          </button>
          <div style={{ position: 'relative' }}>
            <button
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textGray, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            <span style={{ position: 'absolute', top: -1, right: -1, background: '#EF4444', color: C.white, fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>3</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontSize: 13, fontWeight: 600 }}>AJ</div>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: C.textGray }}><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WaveformIcon size={22} color={C.white} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.3 }}>Voice Studio</h1>
            <p style={{ fontSize: 13, color: C.textGray, margin: 0 }}>Create natural, human-like speech using advanced AI voices</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, borderBottom: `1px solid ${C.border}` }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                paddingBottom: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                border: 'none', background: 'none', position: 'relative',
                color: activeTab === tab.id ? C.black : C.textGray,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1, background: C.accent }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────────── */}
      {activeTab === 'text-to-speech' && <TextToSpeech />}
      {activeTab === 'voice-clone'    && <VoiceClone   />}
      {activeTab === 'my-voices'      && <MyVoices     />}
      {activeTab === 'history'        && <History      />}
    </div>
  )
}
