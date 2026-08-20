import { useState, useRef, useEffect } from 'react'

const BRAND = '#367ee3'
const BRAND_DARK = '#2a68c7'

// ── Waveform bars ──────────────────────────────────────────────────────────────
function Waveform({ bars = 28, active = false, small = false }: { bars?: number; active?: boolean; small?: boolean }) {
  const heights = [3,5,8,12,7,10,14,9,6,11,15,8,5,12,9,6,13,10,7,11,8,5,9,13,7,10,6,8]
  const h = small ? 18 : 28
  return (
    <svg width={bars * (small ? 3 : 4)} height={h} viewBox={`0 0 ${bars * (small ? 3 : 4)} ${h}`} className="flex-shrink-0">
      {Array.from({ length: bars }).map((_, i) => {
        const barH = Math.max(2, (heights[i % heights.length] / 15) * h * 0.85)
        const x = i * (small ? 3 : 4)
        const y = (h - barH) / 2
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={small ? 2 : 2.5}
            height={barH}
            rx={1}
            fill={active ? BRAND : '#d1d5db'}
            opacity={active ? 0.75 + (i % 3) * 0.08 : 1}
          />
        )
      })}
    </svg>
  )
}

// ── Player waveform (longer) ───────────────────────────────────────────────────
function PlayerWaveform() {
  const count = 80
  const h = [3,5,8,12,7,10,14,9,6,11,15,8,5,12,9,6,13,10,7,11,8,5,9,13,7,10,6,8,12,4,7,10,14,9,6,11,15,8,5,12,9,6,13,10,7,11,8,5,9,13,7,10,6,8,12,4,7,10,14,6,11,15,8,5,12,9,6,13,10,7,11,8,5,9,13,7,10,6,8,12]
  const totalW = count * 6
  const totalH = 32
  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="flex-shrink-0">
      {Array.from({ length: count }).map((_, i) => {
        const barH = Math.max(3, (h[i % h.length] / 15) * totalH * 0.9)
        const x = i * 6
        const y = (totalH - barH) / 2
        const progress = i / count
        const isPast = progress < 0.0
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={3}
            height={barH}
            rx={1.5}
            fill={isPast ? BRAND : '#d1d5db'}
          />
        )
      })}
    </svg>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const ChevronDownIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const ChevronLeftIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const SparkleIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
  </svg>
)
const SlidersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
    <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
    <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
    <line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
)
const BookmarkIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
)
const PlayIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const PauseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
)
const SkipBackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
)
const SkipFwdIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
)
const VolumeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const MoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
  </svg>
)
const WaveformIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2"/>
  </svg>
)
const CheckVerifiedIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const MessageSquareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const MonitorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)
const MegaphoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>
)
const VideoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
)
const FireIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>
  </svg>
)

// ── Voice data ──────────────────────────────────────────────────────────────────
const voices = [
  {
    id: 1,
    name: 'Jessa',
    desc: 'Easygoing and Effortless',
    tag: 'Narration',
    lang: 'English (US)',
    extra: 12,
    img: 'https://images.unsplash.com/photo-1674932668403-33398b81c92f?w=80&h=80&fit=crop&auto=format',
  },
  {
    id: 2,
    name: 'Adam',
    desc: 'American, Dark and Tough',
    tag: 'Characters',
    lang: 'English (US)',
    extra: 22,
    img: 'https://images.unsplash.com/photo-1637059880830-59a90102de77?w=80&h=80&fit=crop&auto=format',
  },
  {
    id: 3,
    name: 'Sully',
    desc: 'Mature, Deep and Intriguing',
    tag: 'Narration',
    lang: 'English (US)',
    extra: 28,
    img: 'https://images.unsplash.com/photo-1728463087277-97c8d8c7b6a4?w=80&h=80&fit=crop&auto=format',
  },
  {
    id: 4,
    name: 'Jon',
    desc: 'Calm Presence',
    tag: 'Conversational',
    lang: 'English (US)',
    extra: 19,
    img: 'https://images.unsplash.com/photo-1584984647264-7e6f4e6d6b91?w=80&h=80&fit=crop&auto=format',
  },
  {
    id: 5,
    name: 'Derek',
    desc: 'Fun & Energetic',
    tag: 'Advertisement',
    lang: 'English (US)',
    extra: 5,
    img: 'https://images.unsplash.com/photo-1669277752825-d7c26a392b4d?w=80&h=80&fit=crop&auto=format',
  },
  {
    id: 6,
    name: 'Jon',
    desc: 'Catalyst',
    tag: 'Social Media',
    lang: 'English (US)',
    extra: 20,
    img: 'https://images.unsplash.com/photo-1587837073080-448bc6a2329b?w=80&h=80&fit=crop&auto=format',
  },
]

// ── US Flag emoji svg ──────────────────────────────────────────────────────────
const USFlag = () => (
  <span style={{ fontSize: 13, lineHeight: 1 }}>🇺🇸</span>
)

// ── Voice Card ─────────────────────────────────────────────────────────────────
function VoiceCard({ voice, onPlay, isPlaying }: {
  voice: typeof voices[0]
  onPlay: () => void
  isPlaying: boolean
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 cursor-pointer transition-all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 0,
        boxShadow: hovered
          ? '0 4px 20px rgba(54,126,227,0.10), 0 1px 4px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.05)',
        borderColor: hovered ? 'rgba(54,126,227,0.25)' : '#f0f0f0',
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
          <img
            src={voice.img}
            alt={voice.name}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Verified badge */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: BRAND, border: '1.5px solid white' }}
        >
          <CheckVerifiedIcon />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="font-semibold text-sm text-gray-900 truncate">{voice.name}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={BRAND} className="flex-shrink-0">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p className="text-xs text-gray-500 truncate mb-1.5">{voice.desc}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{voice.tag}</span>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <USFlag />
          <span className="text-xs text-gray-400">{voice.lang}</span>
          <span className="text-xs text-gray-400 ml-0.5">+{voice.extra}</span>
        </div>
      </div>

      {/* Right side: bookmark + waveform + play */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setBookmarked(!bookmarked) }}
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <BookmarkIcon filled={bookmarked} />
        </button>
        <div className="flex items-center gap-2">
          <Waveform bars={18} active={isPlaying} small />
          <button
            onClick={(e) => { e.stopPropagation(); onPlay() }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-colors flex-shrink-0"
            style={{ background: isPlaying ? BRAND_DARK : BRAND }}
          >
            {isPlaying ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'myvoices'>('explore')
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [playerLiked, setPlayerLiked] = useState(false)
  const [volume, setVolume] = useState(75)
  const [librarySearch, setLibrarySearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Conversational')

  const playingVoice = voices.find(v => v.id === playingId) || voices[0]

  const categories = [
    { label: 'Conversational', icon: <MessageSquareIcon /> },
    { label: 'Narration', icon: <BookIcon /> },
    { label: 'Characters', icon: <UserIcon /> },
    { label: 'Social Media', icon: <MonitorIcon /> },
    { label: 'Educational', icon: <BookIcon /> },
    { label: 'Advertisement', icon: <MegaphoneIcon /> },
    { label: 'Cinematic', icon: <VideoIcon /> },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f5', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Main Content ── */}
      <main className="pt-0 pb-20">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* ── Page Header ── */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #e8f1fd 0%, #d0e3fb 100%)', border: '1px solid #c5d9f8' }}
              >
                <WaveformIcon size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1" style={{ letterSpacing: '-0.5px' }}>Voices</h1>
                <p className="text-sm text-gray-400">Discover premium AI voices or create your own. Built for every industry, every story.</p>
              </div>
            </div>

            <div className="flex items-stretch gap-3">
              {/* Credits card */}
              <div
                className="rounded-2xl px-5 py-3 flex items-center gap-4"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f4f8ff 100%)',
                  border: '1px solid #e2ecfb',
                  boxShadow: '0 1px 4px rgba(54,126,227,0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #e8f1fd 0%, #cfe2fb 100%)' }}
                  >
                    <WaveformIcon size={17} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium tracking-wide uppercase" style={{ fontSize: 10 }}>Credits Balance</p>
                    <p className="text-xl font-bold text-gray-900" style={{ letterSpacing: '-0.5px' }}>12,450</p>
                    <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>+450 this month</p>
                  </div>
                </div>
                <button
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ border: '1px solid #d0e3fb', color: BRAND }}
                >
                  <ChevronRightIcon size={12} />
                </button>
              </div>

              {/* Create Voice button */}
              <button
                className="text-white rounded-2xl px-5 py-3 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${BRAND} 0%, #2d6cd4 100%)`,
                  boxShadow: '0 2px 12px rgba(54,126,227,0.35)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 18px rgba(54,126,227,0.45)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(54,126,227,0.35)')}
              >
                <div className="flex items-center gap-1.5">
                  <SparkleIcon size={13} />
                  <span className="font-semibold text-sm">Create Voice</span>
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Clone or design</span>
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
            {[
              { id: 'explore', label: 'Explore', icon: <WaveformIcon size={14} /> },
              { id: 'myvoices', label: 'My Voices', icon: <UserIcon /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px"
                style={
                  activeTab === tab.id
                    ? { borderColor: BRAND, color: BRAND }
                    : { borderColor: 'transparent', color: '#9ca3af' }
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Search + Filters row ── */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                placeholder="Search library voices..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-100 rounded-xl outline-none transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(54,126,227,0.4)')}
                onBlur={e => (e.currentTarget.style.borderColor = '#f0f0f0')}
              />
            </div>
            <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-colors shadow-sm">
              <SparkleIcon size={15} />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-600 hover:border-blue-200 hover:text-blue-600 transition-colors font-medium shadow-sm">
              <SlidersIcon />
              Filters
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-600 hover:border-blue-200 hover:text-blue-600 transition-colors font-medium shadow-sm">
              Most Popular
              <ChevronDownIcon />
            </button>
          </div>

          {/* ── Filter pills row ── */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto hide-scrollbar">
            {/* Language */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0">
              <span className="text-gray-500">Language</span>
              <span className="font-semibold">English</span>
              <ChevronDownIcon size={12} />
            </button>
            {/* Accent */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0">
              <span className="text-gray-500">Accent</span>
              <span className="font-semibold">All</span>
              <ChevronDownIcon size={12} />
            </button>
            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
            {/* Categories */}
            {categories.map(cat => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
                style={
                  activeCategory === cat.label
                    ? { background: BRAND, color: '#fff', border: `1px solid ${BRAND}`, boxShadow: '0 2px 8px rgba(54,126,227,0.28)' }
                    : { background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb' }
                }
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
            <button className="flex-shrink-0 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <ChevronRightIcon size={12} />
            </button>
          </div>

          {/* ── Promo Banner ── */}
          <div
            className="rounded-2xl p-6 mb-8 flex items-center gap-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #f0f6ff 0%, #e8f1fd 60%, #dceafb 100%)',
              border: '1px solid #d0e3fb',
              boxShadow: '0 2px 12px rgba(54,126,227,0.08)',
            }}
          >
            {/* Decorative gradient orb */}
            <div
              className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(54,126,227,0.12) 0%, transparent 70%)' }}
            />

            {/* Waveform illustration */}
            <div
              className="w-28 h-24 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(54,126,227,0.15)' }}
            >
              <div className="flex items-end gap-1">
                {[8, 14, 20, 28, 22, 16, 10, 18, 26, 20, 14, 8].map((h, i) => (
                  <div
                    key={i}
                    className="wave-bar rounded-full"
                    style={{
                      width: 4,
                      height: h,
                      background: BRAND,
                      opacity: 0.7 + (i % 3) * 0.1,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '1.4s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Text + CTA */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ letterSpacing: '-0.3px' }}>
                Create a voice that's uniquely yours
              </h2>
              <p className="text-sm text-gray-500 mb-4">Clone your voice or design a brand new one with advanced AI. Fast, secure, and production ready.</p>
              <button
                className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${BRAND} 0%, #2d6cd4 100%)`,
                  boxShadow: '0 2px 10px rgba(54,126,227,0.35)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(54,126,227,0.45)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(54,126,227,0.35)')}
              >
                <SparkleIcon size={13} />
                Clone Your Voice
              </button>
            </div>

            {/* Features grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 flex-shrink-0">
              {[
                { icon: <ShieldIcon />, title: 'Ultra realistic', sub: 'Human-like expressiveness' },
                { icon: <GlobeIcon />, title: 'Multi-language', sub: '30+ languages supported' },
                { icon: <PlayIcon size={14} />, title: 'Instant preview', sub: 'Hear before you use' },
                { icon: <LockIcon />, title: 'Commercial use', sub: 'Safe for your projects' },
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0" style={{ color: BRAND }}>{feat.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{feat.title}</p>
                    <p className="text-xs text-gray-400">{feat.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Trending Voices ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">Trending voices</h3>
                <FireIcon />
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                  View all
                  <ChevronRightIcon size={13} />
                </button>
                <button className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                  <ChevronLeftIcon size={13} />
                </button>
                <button className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                  <ChevronRightIcon size={13} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {voices.map(voice => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  onPlay={() => setPlayingId(voice.id === playingId ? null : voice.id)}
                  isPlaying={playingId === voice.id}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Bottom Audio Player ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 h-[72px] flex items-center px-6 gap-4"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e8f0fd' }}
      >
        {/* Voice info */}
        <div className="flex items-center gap-3 w-64 flex-shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            <img
              src={playingVoice.img}
              alt={playingVoice.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {playingVoice.name} – {playingVoice.desc}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{playingVoice.tag}</span>
              <div className="flex items-center gap-1">
                <USFlag />
                <span className="text-xs text-gray-400">{playingVoice.lang}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setPlayerLiked(!playerLiked)}
            className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-1"
          >
            <HeartIcon filled={playerLiked} />
          </button>
        </div>

        {/* Controls + waveform */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <button className="text-gray-500 hover:text-gray-900 transition-colors">
            <SkipBackIcon />
          </button>
          <button
            onClick={() => setPlayingId(playingId ? null : playingVoice.id)}
            className="w-10 h-10 rounded-full text-white flex items-center justify-center transition-all"
            style={{
              background: `linear-gradient(135deg, ${BRAND} 0%, #2d6cd4 100%)`,
              boxShadow: '0 2px 10px rgba(54,126,227,0.4)',
            }}
          >
            {playingId ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button className="text-gray-500 hover:text-gray-900 transition-colors">
            <SkipFwdIcon />
          </button>

          {/* Waveform */}
          <div className="flex items-center gap-2 overflow-hidden">
            <PlayerWaveform />
          </div>

          {/* Time */}
          <span className="text-xs text-gray-400 whitespace-nowrap font-mono">0:00 / 0:30</span>
        </div>

        {/* Volume + more */}
        <div className="flex items-center gap-3 w-44 flex-shrink-0 justify-end">
          <button className="text-gray-500 hover:text-gray-700 transition-colors">
            <VolumeIcon />
          </button>
          <div className="relative w-24 h-1.5 bg-gray-200 rounded-full cursor-pointer">
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${volume}%`, background: BRAND }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow"
              style={{ left: `calc(${volume}% - 6px)`, background: BRAND }}
            />
          </div>
          <button className="text-gray-400 hover:text-gray-700 transition-colors">
            <MoreIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
