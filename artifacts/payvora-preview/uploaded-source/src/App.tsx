import { useState } from 'react'

// ── Color tokens (spec-compliant) ──────────────────────────────────────────
const C = {
  sidebar:    '#13161C',
  surfacePri: '#21232B',
  surfaceSec: '#23252E',
  page:       '#FBFAFC',
  card:       '#FFFFFF',
  hover:      '#FFF2F0',
  brand:      '#f97316',
}

// ── Static data ───────────────────────────────────────────────────────────
const CHAT_HISTORY = {
  Today: ['New conversation', 'AI voice clone for a character', 'Create a futuristic city image'],
  Yesterday: ['Fix this code bug', 'Customer support email draft'],
  'Previous 7 days': ['Marketing strategy ideas', 'Python script for data analysis'],
}

const WORKSPACE_ITEMS = [
  { Icon: ChatIcon,  label: 'AI Chat',         active: true },
  { Icon: MicIcon,   label: 'Voice Studio' },
  { Icon: ImgIcon,   label: 'Image Studio' },
  { Icon: VidIcon,   label: 'Video Studio' },
  { Icon: FileIcon,  label: 'Document Studio' },
]

const EXPLORE_ITEMS = [
  { Icon: AgentIcon,  label: 'AI Agents' },
  { Icon: GridIcon,   label: 'Templates' },
  { Icon: BookIcon,   label: 'Knowledge Base' },
  { Icon: FolderIcon, label: 'Projects' },
  { Icon: PlugIcon,   label: 'Integrations' },
]

const SETTINGS_ITEMS = [
  { Icon: GearIcon,   label: 'Settings' },
  { Icon: CardIcon,   label: 'Billing' },
  { Icon: HelpIcon,   label: 'Help & Support' },
]

const STUDIO_CARDS = [
  { bg: '#f3e8ff', fg: '#9333ea', Icon: ChatBubbleIcon, title: 'AI Chat',      sub: 'Have intelligent conversations' },
  { bg: '#dcfce7', fg: '#16a34a', Icon: MicFillIcon,    title: 'Voice Studio', sub: 'Clone voices and generate speech' },
  { bg: '#dbeafe', fg: '#2563eb', Icon: ImgFillIcon,    title: 'Image Studio', sub: 'Create stunning AI images' },
  { bg: '#ffedd5', fg: '#ea580c', Icon: VidFillIcon,    title: 'Video Studio', sub: 'Generate AI videos' },
]

const RECENT_PROJECTS = [
  { bg: '#f3e8ff', fg: '#9333ea', Icon: WaveIcon,  title: 'AI Voice Assistant', time: 'Updated 2h ago' },
  { bg: '#dcfce7', fg: '#16a34a', Icon: BrandIcon,  title: 'Brand Images',       time: 'Updated 5h ago' },
  { bg: '#ffedd5', fg: '#ea580c', Icon: ScriptIcon, title: 'YouTube Script',     time: 'Updated 1d ago' },
]

const TOOLS = [
  { bg: '#faf5ff', fg: '#9333ea', Icon: Spk1Icon, label: 'Text to Speech' },
  { bg: '#eff6ff', fg: '#2563eb', Icon: Spk2Icon, label: 'Speech to Text' },
  { bg: '#eff6ff', fg: '#3b82f6', Icon: I2IIcon,  label: 'Image to Image' },
  { bg: '#faf5ff', fg: '#7c3aed', Icon: T2VIcon,  label: 'Text to Video' },
  { bg: '#faf5ff', fg: '#6d28d9', Icon: CodeIcon, label: 'Code Interpreter' },
]

const QUICK = [
  { emoji: '✏️', label: 'Write anything' },
  { emoji: '💡', label: 'Brainstorm ideas' },
  { emoji: '📊', label: 'Analyze data' },
  { emoji: '{ }', label: 'Solve problems' },
  { emoji: '🔍', label: 'Research topic' },
]

export default function App() {
  const [activeNav, setActiveNav] = useState('AI Chat')
  const [message, setMessage] = useState('')

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.page, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <aside style={{ width: 248, flexShrink: 0, background: C.sidebar, display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: C.brand, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" fill="white" fillOpacity="0.85"/>
                <path d="M7 4L10 5.8V8.8L7 10.5L4 8.8V5.8L7 4Z" fill="white"/>
              </svg>
            </div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>Payvora AI</span>
          </div>
          <button style={ghostBtn}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13 2L8 7L13 12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* New Chat */}
        <div style={{ padding: '0 12px 8px' }}>
          <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 500, transition: 'background 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v10M1.5 6.5h10" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
              New Chat
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: 5 }}>⌘K</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3"/><path d="M8.5 8.5L10.5 10.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <input type="text" placeholder="Search chats" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, width: '100%' }} />
          </div>
        </div>

        {/* Scrollable nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>

          {/* Chats */}
          <SideSection label="Chats" chevron="down">
            {Object.entries(CHAT_HISTORY).map(([group, items]) => (
              <div key={group}>
                <p style={groupLabel}>{group}</p>
                {items.map((item, i) => (
                  <SideItem key={item} label={item} active={i === 0 && group === 'Today'} onClick={() => {}} />
                ))}
              </div>
            ))}
            <button style={viewAllBtn}>View all chats →</button>
          </SideSection>

          {/* AI Workspace */}
          <SideSection label="AI Workspace" chevron="up">
            {WORKSPACE_ITEMS.map(({ Icon, label }) => (
              <SideItem key={label} label={label} icon={<Icon />} active={activeNav === label} onClick={() => setActiveNav(label)} />
            ))}
          </SideSection>

          {/* Explore */}
          <SideSection label="Explore">
            {EXPLORE_ITEMS.map(({ Icon, label }) => (
              <SideItem key={label} label={label} icon={<Icon />} onClick={() => {}} />
            ))}
          </SideSection>

          {/* Settings */}
          <SideSection label="Settings & Account">
            {SETTINGS_ITEMS.map(({ Icon, label }) => (
              <SideItem key={label} label={label} icon={<Icon />} onClick={() => {}} />
            ))}
          </SideSection>

        </div>

        {/* User profile */}
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials="AJ" size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, color: '#fff', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ademola Johnson</p>
              <p style={{ margin: 0, color: '#a855f7', fontSize: 10, marginTop: 1 }}>Pro Plan</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.page, height: '100%', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 24px', height: 56, background: C.page, borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: `1px solid ${C.brand}40`, borderRadius: 20, background: 'transparent', color: C.brand, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill={C.brand}><path d="M6 .5l1.3 4H12L8.5 7l1.3 4L6 9 2.2 11l1.3-4L0 4.5h4.7z"/></svg>
            Upgrade
          </button>
          <button style={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a5 5 0 015 5V9l1.5 2H1.5L3 9V6.5a5 5 0 015-5zM6.5 13.5a1.5 1.5 0 003 0" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Avatar initials="AJ" size={32} />
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
        </header>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 0' }}>

          {/* Greeting */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#000', letterSpacing: '-0.02em' }}>Good afternoon, Ademola 👋</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>What would you like to create today?</p>
          </div>

          {/* Studio cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            {STUDIO_CARDS.map(({ bg, fg, Icon, title, sub }) => (
              <div key={title} style={{ background: C.card, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 20, padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ width: 48, height: 48, background: bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon color={fg} />
                </div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#000' }}>{title}</p>
                <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>{sub}</p>
                <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.3)' }}>→</span>
              </div>
            ))}
          </div>

          {/* Chat panel */}
          <div style={{ background: C.card, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 20, padding: '24px 24px 0', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, background: C.brand, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" fill="white" fillOpacity="0.85"/>
                  <path d="M7 4L10 5.8V8.8L7 10.5L4 8.8V5.8L7 4Z" fill="white"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#000', letterSpacing: '-0.02em' }}>How can I help you today?</h2>
            </div>

            {/* Quick action chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {QUICK.map(({ emoji, label }) => (
                <button key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 24, background: C.card, color: 'rgba(0,0,0,0.65)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.borderColor = `${C.brand}40` }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)' }}
                >
                  <span style={{ fontSize: 12 }}>{emoji}</span>{label}
                </button>
              ))}
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 24, background: C.card, color: 'rgba(0,0,0,0.65)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                ··· More
              </button>
            </div>

            <div style={{ height: 32 }} />
          </div>

          {/* Message input */}
          <div style={{ background: C.card, border: '1px solid rgba(0,0,0,0.09)', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.05)', marginBottom: 0 }}>
            <div style={{ padding: '14px 16px 8px' }}>
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Message Payvora AI..."
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#000', lineHeight: 1.5 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {[PlusI, GlobeI, AttachI, MicI].map((Icon, i) => (
                  <button key={i} style={inputIconBtn}>
                    <Icon />
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, background: 'transparent', fontSize: 12, color: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="#999" strokeWidth="1.2"/><path d="M6.5 4v3l2 2" stroke="#999" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  GPT-4o
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="#999" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
                <button style={{ width: 34, height: 34, background: '#111', borderRadius: 10, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12V2M3 6l4-4 4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(0,0,0,0.3)', padding: '12px 0 24px' }}>Payvora AI can make mistakes. Check important info.</p>
        </div>
      </main>

      {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside style={{ width: 316, flexShrink: 0, background: C.page, borderLeft: '1px solid #EAECEF', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* CARD 1 — Recent Projects */}
          <div style={rCard}>
            <div style={rCardHeader}>
              <span style={rCardTitle}>Recent Projects</span>
              <button style={rViewAll}>View all</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {RECENT_PROJECTS.map(({ bg, fg, Icon, title, time }, i) => (
                <ProjectRow key={title} bg={bg} fg={fg} Icon={Icon} title={title} time={time} last={i === RECENT_PROJECTS.length - 1} />
              ))}
            </div>

            <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid #EAECEF' }}>
              <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '-0.01em' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#000')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(0,0,0,0.45)')}
              >
                View all projects
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>

          {/* CARD 2 — Tools */}
          <div style={rCard}>
            <div style={rCardHeader}>
              <span style={rCardTitle}>Tools</span>
              <button style={rViewAll}>View all</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TOOLS.map(({ bg, fg, Icon, label }) => (
                <ToolRow key={label} bg={bg} fg={fg} Icon={Icon} label={label} />
              ))}
            </div>
          </div>

          {/* CARD 3 — Usage */}
          <div style={rCard}>
            <div style={rCardHeader}>
              <span style={rCardTitle}>Usage</span>
              <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', fontWeight: 400 }}>Resets in 12 days</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <UsageBar label="AI Messages"      cur={12540} max={50000} color="#9333ea" />
              <UsageBar label="Voice Generation" cur={45}    max={200}   color="#16a34a" unit="mins" />
              <UsageBar label="Image Generation" cur={320}   max={1000}  color="#3b82f6" />
            </div>
          </div>

        </div>
      </aside>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: 'linear-gradient(135deg,#fb923c,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function SideSection({ label, children, chevron }: { label: string; children: React.ReactNode; chevron?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px 6px' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {chevron && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d={chevron === 'up' ? 'M3 7.5L6 4.5L9 7.5' : 'M3 4.5L6 7.5L9 4.5'} stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      {children}
    </div>
  )
}

function SideItem({ label, icon, active, onClick }: { label: string; icon?: React.ReactNode; active?: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const bg = active ? '#23252E' : hov ? '#21232B' : 'transparent'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, border: 'none', background: bg, color: active ? '#fff' : 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s, color 0.12s' }}
    >
      {icon && <span style={{ opacity: active ? 1 : 0.75, display: 'flex' }}>{icon}</span>}
      {label}
    </button>
  )
}

// Right sidebar card style tokens
const rCard: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EAECEF',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}
const rCardHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
}
const rCardTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 650, color: '#000', letterSpacing: '-0.01em',
}
const rViewAll: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 500, padding: 0, lineHeight: 1,
}

function ProjectRow({ bg, fg, Icon, title, time, last }: { bg: string; fg: string; Icon: React.FC<IconProps>; title: string; time: string; last: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', background: hov ? '#FFF2F0' : 'transparent', transition: 'background 0.13s', marginBottom: last ? 0 : 2 }}
    >
      <div style={{ width: 36, height: 36, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon color={fg} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#000', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(0,0,0,0.38)', lineHeight: 1 }}>{time}</p>
      </div>
    </div>
  )
}

function ToolRow({ bg, fg, Icon, label }: { bg: string; fg: string; Icon: React.FC<IconProps>; label: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', borderRadius: 10, cursor: 'pointer', background: hov ? '#FFF2F0' : 'transparent', transition: 'background 0.13s' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, background: bg, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon color={fg} size={14} />
        </div>
        <span style={{ fontSize: 13, color: '#000', fontWeight: 450, letterSpacing: '-0.01em' }}>{label}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3.5L8.5 7L5 10.5" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function UsageBar({ label, cur, max, color, unit = '' }: { label: string; cur: number; max: number; color: string; unit?: string }) {
  const pct = Math.min(100, Math.round((cur / max) * 100))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#000', letterSpacing: '-0.01em' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', fontVariantNumeric: 'tabular-nums' }}>
          {cur.toLocaleString()} / {max.toLocaleString()}{unit ? ' ' + unit : ''}
        </span>
      </div>
      <div style={{ height: 5, background: '#EAECEF', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── Inline styles ─────────────────────────────────────────────────────────

const ghostBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
}
const iconBtn: React.CSSProperties = {
  width: 34, height: 34, background: 'none', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
}
const inputIconBtn: React.CSSProperties = {
  width: 32, height: 32, background: 'none', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(0,0,0,0.45)'
}
const groupLabel: React.CSSProperties = {
  margin: '6px 0 2px', padding: '0 8px', fontSize: 9.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500
}
const viewAllBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '4px 8px', display: 'block'
}

// ── Icon Library ──────────────────────────────────────────────────────────

type IconProps = { color?: string; size?: number }

// Sidebar (white stroke icons)
function ChatIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 2.5C1.5 1.8 2 1.5 2.5 1.5h8c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5H4L1.5 12V2.5z" stroke="currentColor" strokeWidth="1.3"/></svg> }
function MicIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4.5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 6.5a4 4 0 008 0M6.5 11v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function ImgIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="4.5" r="1.2" fill="currentColor"/><path d="M1 9.5l3-3 2 2 2-2.5 3 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg> }
function VidIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="3" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M9 5.5l3.5-2v6L9 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg> }
function FileIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 1h5l3 3v8H3V1z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v3h3" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4.5 6.5h4M4.5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function AgentIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 12c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function GridIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="7" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="7" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="7" y="7" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/></svg> }
function BookIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2.5C2 1.7 2.7 1 3.5 1H11v11H3.5A1.5 1.5 0 012 10.5V2.5z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M2 10.5A1.5 1.5 0 003.5 12H11" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4h4M5 6.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function FolderIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 3.5C1 2.7 1.7 2 2.5 2H5l1.5 1.5H10.5c.8 0 1.5.7 1.5 1.5V10c0 .8-.7 1.5-1.5 1.5H2.5C1.7 11.5 1 10.8 1 10V3.5z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg> }
function PlugIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 1.5v3M9 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><rect x="2" y="4.5" width="9" height="3.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 8v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function GearIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 1v1.5M6.5 10V11.5M1 6.5h1.5M10 6.5h1.5M2.6 2.6l1.1 1.1M9.3 9.3l1.1 1.1M2.6 10.4l1.1-1.1M9.3 3.7l1.1-1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function CardIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5.5h11" stroke="currentColor" strokeWidth="1.3"/><path d="M3 8.5h2M3 9.5h1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function HelpIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5a1.5 1.5 0 013 .5c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/></svg> }

// Studio card icons (filled / colorful)
function ChatBubbleIcon({ color }: IconProps) { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 3C3 2 3.9 1 5 1h12c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H7L3 18V3z" stroke={color} strokeWidth="1.8" fill={color + '20'}/><path d="M7 7h8M7 10h5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg> }
function MicFillIcon({ color }: IconProps) { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="7" y="2" width="8" height="11" rx="4" stroke={color} strokeWidth="1.8" fill={color + '20'}/><path d="M4 11a7 7 0 0014 0M11 18v3" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></svg> }
function ImgFillIcon({ color }: IconProps) { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="4" stroke={color} strokeWidth="1.8" fill={color + '20'}/><circle cx="7.5" cy="7.5" r="2" fill={color}/><path d="M2 15l5-5 3.5 3.5 3-3.5L20 16" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg> }
function VidFillIcon({ color }: IconProps) { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="13" height="14" rx="3" stroke={color} strokeWidth="1.8" fill={color + '20'}/><path d="M15 9l6-4v12l-6-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg> }

// Right sidebar project icons
function WaveIcon({ color, size = 16 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M1 8h1.5V5.5h1.5V11H5.5V4.5H7V13h1.5V2H10v12h1.5V5H13v6h1.5V8" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none"/></svg> }
function BrandIcon({ color, size = 16 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="3" stroke={color} strokeWidth="1.4"/><circle cx="5.5" cy="5.5" r="1.5" fill={color}/><path d="M1 11l4-4 2.5 2.5 2-3 4 4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg> }
function ScriptIcon({ color, size = 16 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 1h7l3 3v11H3V1z" stroke={color} strokeWidth="1.4" fill="none"/><path d="M10 1v3h3" stroke={color} strokeWidth="1.2"/><path d="M5 7h6M5 9.5h5M5 12h4" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg> }

// Tool icons
function Spk1Icon({ color, size = 13 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 13 13" fill="none"><path d="M1.5 4h5.5l2 2-2 2H1.5V4z" stroke={color} strokeWidth="1.2" fill="none"/><path d="M9 5.5c1.2.4 2 1.2 2 2.5s-.8 2.1-2 2.5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg> }
function Spk2Icon({ color, size = 13 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 13 13" fill="none"><rect x="4.5" y="1" width="4" height="6.5" rx="2" stroke={color} strokeWidth="1.2"/><path d="M2.5 6.5a4 4 0 008 0M6.5 10v2" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg> }
function I2IIcon({ color, size = 13 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="10" height="8" rx="1.8" stroke={color} strokeWidth="1.2"/><path d="M1 7.5l3-3 2 2 2-2.5 3 3" stroke={color} strokeWidth="1.1" strokeLinecap="round" fill="none"/><path d="M7 11h5M10 9.5l2 1.5-2 1.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg> }
function T2VIcon({ color, size = 13 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 13 13" fill="none"><rect x="1" y="3" width="8" height="7" rx="1.5" stroke={color} strokeWidth="1.2"/><path d="M9 5.5l3.5-2v5L9 7" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg> }
function CodeIcon({ color, size = 13 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 13 13" fill="none"><path d="M4.5 4L1.5 6.5L4.5 9M8.5 4L11.5 6.5L8.5 9M7 1.5l-1.5 10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg> }

// Input bar icons
function PlusI() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function GlobeI() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1.5c-2 2.5-2 8.5 0 11M1.5 7h11" stroke="currentColor" strokeWidth="1.1"/></svg> }
function AttachI() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 6.5L6.5 12A4 4 0 011 7L7 1A2.5 2.5 0 0110.5 4.5L5 10A1 1 0 013.5 8.5L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function MicI() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="1" width="5" height="7.5" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 7a4.5 4.5 0 009 0M7 12v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
