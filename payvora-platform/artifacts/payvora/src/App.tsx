import { useEffect, useRef, useState } from 'react'
import VoiceStudioApp from './voice-studio/VoiceStudioApp'
import ImportedVoicePage from './imported-voice-wrapper'
import { PAGE_PATHS, RegistryPage, isRegistryLabel, labelForPath } from './pages/registry'
import ChatPanel from './chat/ChatPanel'
import { useGlobalShortcuts } from './lib/shortcuts'
import { useTheme } from './lib/theme'
import { getJson } from './lib/http'
import { BottomWorkspacePanel, RightWorkspacePanel, WorkspaceControls, type WorkspaceTool } from './components/WorkspaceControls'
import VoiceWaveform from './VoiceWaveform'
import { useVoiceEngine } from './voiceEngineContext'

type SidebarConversation = { id: number; title: string; createdAt: string }
type ComposerAttachment = { id: string; file: File; previewUrl?: string }

// React 18 has no `inert` prop; set the DOM property via a callback ref.
const inertWhen = (inert: boolean) => (el: HTMLElement | null) => { if (el) el.inert = inert }

function SunIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="4" stroke="var(--pv-text)" strokeWidth="1.6"/><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M4 16l1.4-1.4M14.6 5.4L16 4" stroke="var(--pv-text)" strokeWidth="1.6" strokeLinecap="round"/></svg> }
function MoonIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M16.5 12.2A7 7 0 017.8 3.5a7 7 0 108.7 8.7z" stroke="var(--pv-text)" strokeWidth="1.6" strokeLinejoin="round"/></svg> }

const NAV_PATHS: Record<string, string> = {
  'AI Chat': '/',
  'Voice Studio': '/voice-studio',
  'Voice Library': '/voices',
  ...PAGE_PATHS,
}

function navForPath(pathname: string) {
  if (pathname === '/voice-studio') return 'Voice Studio'
  if (pathname === '/voices') return 'Voice Library'
  return labelForPath(pathname) ?? 'AI Chat'
}

// Grouped enterprise sidebar (fintech structure). "Dashboard" is the
// ChatGPT-style AI home; "Library" is the document library (/documents).
const NAV_GROUPS: Array<{ title: string; items: Array<{ label: string; nav: string; Icon: React.FC }> }> = [
  {
    title: 'Studio',
    items: [
      { label: 'Voice Studio', nav: 'Voice Studio', Icon: WaveIcon },
      { label: 'Voice Library', nav: 'Voice Library', Icon: WaveIcon },
      { label: 'Templates', nav: 'Templates', Icon: GridIcon },
    ],
  },
  {
    title: 'Knowledge & Automation',
    items: [
      { label: 'Projects', nav: 'Projects', Icon: ProjectsIcon },
      { label: 'Integrations', nav: 'Integrations', Icon: PlugIcon },
    ],
  },
]

export default function App() {
  const { resolved, setMode } = useTheme()
  const [activeNav, setActiveNav] = useState(() => navForPath(window.location.pathname))
  const [message, setMessage] = useState('')
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(max-width: 760px)').matches)
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [interactionMessage, setInteractionMessage] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInitial, setChatInitial] = useState<string | undefined>(undefined)
  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [sidebarConvos, setSidebarConvos] = useState<SidebarConversation[]>([])
  const [displayName, setDisplayName] = useState('')
  const [planName, setPlanName] = useState('')
  // Home composer mode: expandable panel like the reference ("Write or edit")
  const [homeMode, setHomeMode] = useState<'none' | 'write'>('none')
  const [composerFocused, setComposerFocused] = useState(false)
  const [chatMenuOpen, setChatMenuOpen] = useState(false)
  // Remount key for ChatPanel — bumped only when the user starts/opens a chat,
  // never when a new conversation id arrives mid-stream (that caused a re-send).
  const [chatSession, setChatSession] = useState(0)
  const [bottomWorkspaceOpen, setBottomWorkspaceOpen] = useState(false)
  const [rightWorkspaceOpen, setRightWorkspaceOpen] = useState(false)
  const [workspaceTool, setWorkspaceTool] = useState<WorkspaceTool | null>(null)
  const chatMenuRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const isStudio = activeNav === 'Voice Studio'

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)')
    const sync = () => {
      setIsMobile(mediaQuery.matches)
      setSidebarOpen(!mediaQuery.matches)
    }
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!(isMobile && sidebarOpen)) return
    // Modal drawer: remember the invoking control, move focus into the drawer,
    // and make the main content inert so keyboard users can't tab behind it.
    const invoker = document.activeElement as HTMLElement | null
    const main = mainRef.current
    if (main) main.inert = true
    const firstFocusable = sidebarRef.current?.querySelector<HTMLElement>('button, input, [tabindex]')
    firstFocusable?.focus()
    const closeWithEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('keydown', closeWithEscape)
      if (main) main.inert = false
      invoker?.focus?.()
    }
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    const syncRoute = () => setActiveNav(navForPath(window.location.pathname))
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (!profileOpen) return
    const closeMenus = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false) }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [profileOpen])

  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchInputRef.current?.focus(), 50)
    else setChatSearch('')
  }, [searchOpen])

  useEffect(() => {
    if (!chatMenuOpen) return
    const closeMenus = (event: PointerEvent) => {
      if (!chatMenuRef.current?.contains(event.target as Node)) setChatMenuOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setChatMenuOpen(false) }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [chatMenuOpen])

  useEffect(() => {
    const closeWorkspaceWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (rightWorkspaceOpen) {
        setRightWorkspaceOpen(false)
        setWorkspaceTool(null)
      } else if (bottomWorkspaceOpen) {
        setBottomWorkspaceOpen(false)
      }
    }
    document.addEventListener('keydown', closeWorkspaceWithEscape)
    return () => document.removeEventListener('keydown', closeWorkspaceWithEscape)
  }, [bottomWorkspaceOpen, rightWorkspaceOpen])

  const refreshSidebarConvos = () => {
    getJson<{ conversations: SidebarConversation[] }>('/chat/conversations')
      .then(data => setSidebarConvos(data.conversations.slice(0, 20)))
      .catch(() => setSidebarConvos([]))
  }

  useEffect(() => {
    refreshSidebarConvos()
    getJson<{ profile?: { displayName?: string } }>('/account/settings')
      .then(data => setDisplayName(data.profile?.displayName ?? ''))
      .catch(() => {})
    getJson<{ subscription?: { planName?: string } }>('/billing/subscription')
      .then(data => setPlanName(data.subscription?.planName ?? ''))
      .catch(() => {})
  }, [])

  const notify = (label: string) => {
    setInteractionMessage(label)
    window.setTimeout(() => setInteractionMessage(current => current === label ? '' : current), 2_400)
  }
  const navigateTo = (label: string, announce = true) => {
    setActiveNav(label)
    if (isMobile) setSidebarOpen(false)
    const path = NAV_PATHS[label]
    if (path && window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    if (announce) notify(`${label} opened`)
  }
  const startNewChat = () => {
    setMessage('')
    setHomeMode('none')
    setChatOpen(false)
    setChatInitial(undefined)
    setActiveConvId(null)
    navigateTo('AI Chat', false)
    messageInputRef.current?.focus()
  }
  const openConversation = (id: number) => {
    setActiveConvId(id)
    setChatInitial(undefined)
    setChatSession(s => s + 1)
    setChatOpen(true)
    navigateTo('AI Chat', false)
  }
  const sendFromComposer = () => {
    const content = message.trim()
    if (!content) return
    setMessage('')
    setHomeMode('none')
    setActiveConvId(null)
    setChatInitial(content)
    setChatSession(s => s + 1)
    setChatOpen(true)
  }
  const toggleHomeMode = (mode: 'write') => {
    setHomeMode(current => (current === mode ? 'none' : mode))
    window.setTimeout(() => messageInputRef.current?.focus(), 60)
  }
  const toggleRightWorkspace = () => {
    setRightWorkspaceOpen(open => {
      const next = !open
      if (next) setWorkspaceTool(null)
      return next
    })
  }
  const closeRightWorkspace = () => {
    setRightWorkspaceOpen(false)
    setWorkspaceTool(null)
  }
  useGlobalShortcuts({ onNewChat: startNewChat, onNavigate: label => navigateTo(label, false) })

  const visibleConvos = sidebarConvos.filter(c => c.title.toLowerCase().includes(chatSearch.trim().toLowerCase()))
  const initials = (displayName || 'Payvora user').split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()

  const SIDEBAR_W = 300

  return (
    <div className="payvora-app payvora-codex-app" style={{ display: 'flex', background: 'var(--pv-page)', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif", overflow: 'hidden' }} aria-live="polite">

      {/* ── Overlay (mobile) ─────────────────────────────────────────────── */}
      <div aria-hidden onClick={() => setSidebarOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'rgba(0,0,0,0.5)', opacity: isMobile && sidebarOpen ? 1 : 0, pointerEvents: isMobile && sidebarOpen ? 'auto' : 'none', transition: 'opacity 320ms cubic-bezier(0.32, 0.72, 0, 1)' }} />

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside ref={el => { sidebarRef.current = el; if (el) el.inert = !sidebarOpen }} className="payvora-sidebar payvora-codex-sidebar" aria-hidden={!sidebarOpen}
        style={{
          width: SIDEBAR_W, maxWidth: '86vw', flexShrink: 0, background: 'var(--pv-sidebar)', display: 'flex', flexDirection: 'column',
          height: '100dvh', position: isMobile ? 'fixed' : 'relative', left: 0, top: 0, zIndex: 30,
          borderRight: isMobile ? 'none' : '1px solid var(--pv-border)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-105%)',
          marginLeft: !isMobile && !sidebarOpen ? -SIDEBAR_W : 0,
          borderRadius: isMobile ? '0 24px 24px 0' : 0,
          boxShadow: isMobile && sidebarOpen ? '0 0 60px rgba(0,0,0,0.35)' : 'none',
          transition: 'transform 360ms cubic-bezier(0.32, 0.72, 0, 1), margin-left 360ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>

        {/* Title + search */}
        <div className="payvora-codex-sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 14px' }}>
          <img
            src={`${import.meta.env.BASE_URL}${resolved === 'dark' ? 'payvora-dark-logo.png' : 'payvora-light-logo.png'}`}
            alt="Payvora"
            style={{ width: 176, height: 'auto', display: 'block' }}
          />
          <div className="payvora-codex-sidebar-utilities">
            <button type="button" aria-label={searchOpen ? 'Close search' : 'Search chats'} aria-expanded={searchOpen} onClick={() => setSearchOpen(v => !v)}
              style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--pv-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 180ms ease' }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="var(--pv-text)" strokeWidth="1.8"/><path d="M13 13l4 4" stroke="var(--pv-text)" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
            <button type="button" aria-label="Notifications" onClick={() => notify('You are all caught up.')} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--pv-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 180ms ease' }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M5.2 8.3a4.8 4.8 0 119.6 0c0 5.1 2 5.2 2 6.4H3.2c0-1.2 2-1.3 2-6.4ZM8.1 17a2 2 0 003.8 0" stroke="var(--pv-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        {/* Search field (expands) */}
        <div ref={inertWhen(!searchOpen)} style={{ padding: searchOpen ? '0 16px 10px' : '0 16px', maxHeight: searchOpen ? 60 : 0, opacity: searchOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 280ms cubic-bezier(0.32,0.72,0,1), opacity 220ms ease, padding 280ms ease' }}>
          <input ref={searchInputRef} aria-label="Search chats" type="search" value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search chats"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 14, border: '1px solid var(--pv-border)', background: 'var(--pv-input-bg)', color: 'var(--pv-text)', fontSize: 14, outline: 'none' }} />
        </div>

        {/* Scrollable content */}
        <div className="payvora-codex-sidebar-content" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 10px 120px' }}>

          {/* Dashboard: the ChatGPT-style AI home */}
          {(() => {
            const active = activeNav === 'AI Chat' && !chatOpen
            return (
              <button type="button" aria-current={active ? 'page' : undefined} onClick={() => startNewChat()}
                className="payvora-side-item"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', marginBottom: 6, borderRadius: 12, border: 'none', position: 'relative',
                  background: active ? 'var(--pv-blue-soft)' : 'transparent', color: active ? 'var(--pv-blue)' : 'var(--pv-text)', fontSize: 14.5, fontWeight: active ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'background 160ms ease, color 160ms ease' }}>
                {active && <span aria-hidden style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, background: 'var(--pv-blue)' }} />}
                <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: active ? 'var(--pv-blue)' : 'var(--pv-text-secondary)' }}><PencilIcon /></span>
                New chat
              </button>
            )
          })()}

          {/* Grouped enterprise nav */}
          {NAV_GROUPS.map(group => {
            const collapsed = collapsedGroups[group.title] ?? false
            const regionId = `pv-nav-${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}`
            return (
              <div key={group.title} style={{ marginBottom: 4 }}>
                <button type="button" aria-expanded={!collapsed} aria-controls={regionId} onClick={() => setCollapsedGroups(g => ({ ...g, [group.title]: !collapsed }))}
                  className="payvora-side-item"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 4px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pv-text-muted)' }}>{group.title}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 240ms cubic-bezier(0.32,0.72,0,1)' }}>
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="var(--pv-text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div id={regionId} aria-hidden={collapsed} ref={inertWhen(collapsed)} style={{ maxHeight: collapsed ? 0 : group.items.length * 48, opacity: collapsed ? 0 : 1, overflow: 'hidden', transition: 'max-height 300ms cubic-bezier(0.32,0.72,0,1), opacity 220ms ease' }}>
                  {group.items.map(({ label, nav, Icon }) => {
                    const active = activeNav === nav && !(nav === 'AI Chat' && chatOpen)
                    return (
                      <button key={label} type="button" aria-current={active ? 'page' : undefined} onClick={() => { if (nav === 'AI Chat') startNewChat(); else navigateTo(nav, false) }}
                        className="payvora-side-item"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 12, border: 'none', position: 'relative',
                          background: active ? 'var(--pv-blue-soft)' : 'transparent', color: active ? 'var(--pv-blue)' : 'var(--pv-text)', fontSize: 14.5, fontWeight: active ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'background 160ms ease, color 160ms ease' }}>
                        {active && <span aria-hidden style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, background: 'var(--pv-blue)' }} />}
                        <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: active ? 'var(--pv-blue)' : 'var(--pv-text-secondary)' }}><Icon /></span>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Recents */}
          <p style={{ margin: '26px 0 6px', padding: '0 12px', fontSize: 17, fontWeight: 700, color: 'var(--pv-text)', letterSpacing: '-0.01em' }}>Recents</p>
          {sidebarConvos.length === 0 ? (
            <p style={{ margin: 0, padding: '6px 12px', fontSize: 14, color: 'var(--pv-text-muted)' }}>No conversations yet.</p>
          ) : visibleConvos.length === 0 ? (
            <p style={{ margin: 0, padding: '6px 12px', fontSize: 14, color: 'var(--pv-text-muted)' }}>No chats match “{chatSearch.trim()}”.</p>
          ) : visibleConvos.map(c => (
            <button key={c.id} type="button" onClick={() => openConversation(c.id)}
              className="payvora-side-item"
              style={{ width: '100%', display: 'block', padding: '11px 12px', borderRadius: 14, border: 'none', background: chatOpen && activeConvId === c.id ? 'var(--pv-hover)' : 'transparent', color: 'var(--pv-text)', fontSize: 15, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'background 160ms ease' }}>
              {c.title}
            </button>
          ))}
        </div>

        {/* Account controls */}
        <div className="payvora-codex-accountbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'linear-gradient(to top, var(--pv-sidebar) 65%, transparent)' }}>
          <div ref={profileMenuRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" aria-label="Profile menu" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block' }}>
                <Avatar initials={initials} size={28} />
              </button>
              <button type="button" className="payvora-codex-account-name" onClick={() => setProfileOpen(v => !v)}>{displayName || 'Payvora workspace'}</button>
            </div>
              {profileOpen && (
                <div role="menu" aria-label="Profile menu" style={{ position: 'absolute', zIndex: 40, left: -60, bottom: 52, width: 240, background: 'var(--pv-card)', border: '1px solid var(--pv-border)', borderRadius: 20, boxShadow: '0 16px 44px rgba(0,0,0,0.22)', padding: 8, animation: 'payvora-menu-in 220ms cubic-bezier(0.32,0.72,0,1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 12px', borderBottom: '1px solid var(--pv-border)' }}>
                    <Avatar initials={initials} size={32} />
                    <div>
                      <p style={{ margin: 0, color: 'var(--pv-text)', fontSize: 13, fontWeight: 600 }}>{displayName || 'Payvora user'}</p>
                      <p style={{ margin: '2px 0 0', color: 'var(--pv-blue)', fontSize: 11 }}>{planName ? `${planName} Plan` : 'Free Plan'}</p>
                    </div>
                  </div>
                  <div style={{ paddingTop: 6 }}>
                    <button type="button" role="menuitem" className="payvora-menu-item" disabled title="Sign-in is not enabled — Payvora uses an anonymous browser session." style={{ ...menuItem, color: '#ff453a', opacity: 0.5, cursor: 'not-allowed' }}>Sign Out</button>
                  </div>
                </div>
              )}
          </div>
          <button type="button" aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
            style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'var(--pv-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── pushed right as a rounded card while the mobile drawer is open */}
      <main ref={mainRef} className="payvora-codex-main" style={{
        flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--pv-page)', overflow: 'hidden',
        transform: isMobile && sidebarOpen ? `translateX(${SIDEBAR_W - 24}px) scale(0.98)` : 'translateX(0) scale(1)',
        borderRadius: isMobile && sidebarOpen ? 28 : 0,
        boxShadow: isMobile && sidebarOpen ? '0 0 48px rgba(0,0,0,0.25)' : 'none',
        transition: 'transform 360ms cubic-bezier(0.32, 0.72, 0, 1), border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}>

        {/* Top bar */}
        <header className="payvora-header payvora-codex-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="payvora-codex-menu-toggle" aria-label={sidebarOpen ? 'Close menu' : 'Open menu'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(v => !v)} style={pillIconBtn}>
              <PencilIcon />
            </button>
            <button type="button" className="payvora-codex-upgrade" onClick={() => notify('Upgrade options are coming soon.')}>
              <span aria-hidden>✦</span> Get Plus
            </button>
          </div>
          {chatOpen && activeNav === 'AI Chat' ? (
            /* In-chat header: new chat + overflow menu, like the reference */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" aria-label="New chat" title="New chat" onClick={startNewChat} style={pillIconBtn}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 17l.9-3.4L13.6 3.9a1.9 1.9 0 012.7 2.7L6.6 16.3 3 17z" stroke="var(--pv-text)" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12.2 5.3l2.7 2.7" stroke="var(--pv-text)" strokeWidth="1.6"/></svg>
              </button>
              <div ref={chatMenuRef} style={{ position: 'relative' }}>
                <button type="button" aria-label="Chat options" aria-haspopup="menu" aria-expanded={chatMenuOpen} onClick={() => setChatMenuOpen(v => !v)} style={pillIconBtn}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="var(--pv-text)"><circle cx="4.5" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/></svg>
                </button>
                {chatMenuOpen && (
                  <div role="menu" aria-label="Chat options" style={{ position: 'absolute', right: 0, top: 48, zIndex: 40, width: 210, background: 'var(--pv-card)', border: '1px solid var(--pv-border)', borderRadius: 18, boxShadow: '0 16px 44px rgba(0,0,0,0.22)', padding: 6, animation: 'payvora-menu-in 220ms cubic-bezier(0.32,0.72,0,1)' }}>
                    <button type="button" role="menuitem" className="payvora-menu-item" style={menuItem} onClick={() => { setChatMenuOpen(false); startNewChat() }}>New chat</button>
                    <button type="button" role="menuitem" className="payvora-menu-item" style={menuItem} onClick={() => { setChatMenuOpen(false); setSidebarOpen(true) }}>View chat history</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="payvora-codex-header-actions">
              <WorkspaceControls
                bottomPanelOpen={bottomWorkspaceOpen}
                rightPanelOpen={rightWorkspaceOpen}
                onToggleBottomPanel={() => setBottomWorkspaceOpen(open => !open)}
                onToggleRightPanel={toggleRightWorkspace}
              />
            </div>
          )}
        </header>

        <div className="payvora-workspace-stage">
          <div className="payvora-workspace-content">
            {/* Body */}
            <div className={chatOpen && activeNav === 'AI Chat' ? 'payvora-main-scroll studio-main-scroll' : 'payvora-main-scroll'}
          data-payvora-scrollbar-root
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: isStudio || isRegistryLabel(activeNav) || (chatOpen && activeNav === 'AI Chat') ? 0 : 0, display: 'flex', flexDirection: 'column' }}>
          {activeNav === 'Voice Studio' ? (
            <div className="voice-studio-page">
              <VoiceStudioApp />
            </div>
          ) : activeNav === 'Voice Library' ? (
            <ImportedVoicePage />
          ) : isRegistryLabel(activeNav) ? (
            <div style={{ padding: '8px 24px 0' }}>
              <RegistryPage label={activeNav} />
            </div>
          ) : chatOpen ? (
            <div style={{ height: '100%' }}>
              <ChatPanel key={chatSession} activeConversationId={activeConvId} initialMessage={chatInitial} onConversationCreated={id => { setActiveConvId(id); refreshSidebarConvos() }} onConversationsChanged={refreshSidebarConvos} />
            </div>
          ) : (
            <CodexHome
              message={message}
              messageInputRef={messageInputRef}
              onMessageChange={setMessage}
              onSubmit={sendFromComposer}
              onPrompt={prompt => {
                setMessage(prompt)
                window.requestAnimationFrame(() => messageInputRef.current?.focus())
              }}
              onUnavailable={notify}
            />
          )}
            </div>
          </div>
          {rightWorkspaceOpen && (
            <RightWorkspacePanel activeTool={workspaceTool} onSelectTool={setWorkspaceTool} onClose={closeRightWorkspace} />
          )}
        </div>
        {bottomWorkspaceOpen && <BottomWorkspacePanel onClose={() => setBottomWorkspaceOpen(false)} />}
      </main>

      {interactionMessage && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, zIndex: 40, transform: 'translateX(-50%)', background: 'var(--pv-text)', color: 'var(--pv-page)', borderRadius: 14, padding: '9px 16px', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', animation: 'payvora-menu-in 200ms ease-out' }}>
          {interactionMessage}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

type CodexHomeProps = {
  message: string
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>
  onMessageChange: (value: string) => void
  onSubmit: () => void
  onPrompt: (prompt: string) => void
  onUnavailable: (message: string) => void
}

function CodexHome({ message, messageInputRef, onMessageChange, onSubmit, onPrompt, onUnavailable }: CodexHomeProps) {
  const engine = useVoiceEngine()
  const seenTranscriptRef = useRef('')
  const attachmentMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRefs = {
    files: useRef<HTMLInputElement>(null),
    images: useRef<HTMLInputElement>(null),
    audio: useRef<HTMLInputElement>(null),
  }
  const attachmentIdRef = useRef(0)
  const attachmentUrlsRef = useRef<ComposerAttachment[]>([])
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const prompts = [
    { label: 'Explore and\nunderstand code', prompt: 'Help me explore and understand this project.', tone: 'blue', icon: <GlobeIcon /> },
    { label: 'Build a new feature,\napp, or tool', prompt: 'Help me build a new feature for PAYVORA.', tone: 'purple', icon: <PencilIcon /> },
    { label: 'Review code and\nsuggest changes', prompt: 'Review this code and suggest improvements.', tone: 'green', icon: <ReviewIcon /> },
    { label: 'Fix issues and failures', prompt: 'Help me diagnose and fix an issue.', tone: 'orange', icon: <BugIcon /> },
  ] as const

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (message.trim()) onSubmit()
  }
  const voiceActive = engine.state === 'connecting'
    || engine.state === 'requesting_permission'
    || engine.isListening
    || engine.isThinking
    || engine.isSpeaking

  useEffect(() => {
    attachmentUrlsRef.current = attachments
  }, [attachments])

  useEffect(() => () => {
    attachmentUrlsRef.current.forEach(attachment => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    })
  }, [])

  useEffect(() => {
    if (!attachmentMenuOpen) return
    const closeMenu = (event: PointerEvent) => {
      if (!attachmentMenuRef.current?.contains(event.target as Node)) setAttachmentMenuOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAttachmentMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [attachmentMenuOpen])

  useEffect(() => {
    const transcript = engine.finalTranscript.trim()
    if (!transcript) {
      seenTranscriptRef.current = ''
      return
    }
    const previous = seenTranscriptRef.current
    if (transcript === previous) return
    const newText = previous && transcript.startsWith(`${previous}\n`)
      ? transcript.slice(previous.length).trim()
      : transcript
    seenTranscriptRef.current = transcript
    if (newText) {
      onMessageChange(message.trim() ? `${message.trim()} ${newText}` : newText)
      onUnavailable('Transcript added to the composer.')
    }
  }, [engine.finalTranscript, message, onMessageChange, onUnavailable])

  const toggleVoiceInput = async () => {
    if (voiceActive) {
      await engine.endVoiceSession()
      return
    }
    try {
      await engine.startVoiceSession()
    } catch (error) {
      const message = engine.error
        || (error instanceof Error ? error.message : 'Realtime voice session failed.')
      onUnavailable(`Voice input failed: ${message}`)
    }
  }

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return
    const selected = Array.from(fileList).map(file => {
      const id = `${file.name}-${file.size}-${file.lastModified}-${attachmentIdRef.current++}`
      return {
        id,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }
    })
    setAttachments(current => [...current, ...selected])
    setAttachmentMenuOpen(false)
  }

  const removeAttachment = (id: string) => {
    setAttachments(current => {
      const attachment = current.find(item => item.id === id)
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      return current.filter(item => item.id !== id)
    })
  }
  const choosePicker = (picker: React.RefObject<HTMLInputElement | null>) => {
    setAttachmentMenuOpen(false)
    window.requestAnimationFrame(() => picker.current?.click())
  }

  return (
    <section className="pv-codex-home" aria-label="New PAYVORA chat">
      <div className="pv-codex-hero">
        <CodexMark />
        <h1>What should we build?</h1>
        <div className="pv-codex-prompts" aria-label="Suggested prompts">
          {prompts.map(({ label, prompt, tone, icon }) => (
            <button key={label} type="button" className="pv-codex-prompt-card" onClick={() => onPrompt(prompt)}>
              <span className={`pv-codex-prompt-icon pv-codex-prompt-icon--${tone}`} aria-hidden>{icon}</span>
              <span>{label.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</span>
            </button>
          ))}
        </div>
      </div>

      <form className="pv-codex-composer-wrap" onSubmit={submit}>
        <button type="button" className="pv-codex-project-picker" onClick={() => onUnavailable('Project selection is coming soon.')}>
          <ProjectsIcon />
          <span>Choose project</span>
        </button>
        <div className="pv-codex-composer">
          {attachments.length > 0 && (
            <div aria-label="Selected attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 18px 0' }}>
              {attachments.map(attachment => (
                <div key={attachment.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%', padding: 6, border: '1px solid var(--pv-border)', borderRadius: 12, background: 'var(--pv-card-raised)', color: 'var(--pv-text)' }}>
                  {attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <span aria-hidden style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'var(--pv-hover)', color: 'var(--pv-text-secondary)', fontSize: 16 }}>↗</span>
                  )}
                  <span title={attachment.file.name} style={{ minWidth: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{attachment.file.name}</span>
                  <button type="button" aria-label={`Remove ${attachment.file.name}`} onClick={() => removeAttachment(attachment.id)} style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', flexShrink: 0, border: 0, borderRadius: 12, background: 'transparent', color: 'var(--pv-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={messageInputRef}
            value={message}
            rows={1}
            onChange={event => onMessageChange(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (message.trim()) onSubmit() } }}
            placeholder="Do anything"
            aria-label="Message PAYVORA"
          />
          <VoiceWaveform variant="composer" />
          <div className="pv-codex-composer-controls">
            <div ref={attachmentMenuRef} style={{ position: 'relative' }}>
              <button type="button" className="pv-codex-control-icon" aria-label="Add attachment" aria-haspopup="menu" aria-expanded={attachmentMenuOpen} onClick={() => setAttachmentMenuOpen(current => !current)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>
              {attachmentMenuOpen && (
                <div role="menu" aria-label="Attachment options" style={{ position: 'absolute', left: 0, bottom: 45, zIndex: 40, width: 190, padding: 6, border: '1px solid var(--pv-border)', borderRadius: 16, background: 'var(--pv-card)', boxShadow: '0 16px 44px rgba(0,0,0,0.22)', animation: 'payvora-menu-in 220ms cubic-bezier(0.32,0.72,0,1)' }}>
                  <AttachmentOption label="Upload files" hint="Any file type" onClick={() => choosePicker(fileInputRefs.files)} icon={<FileIcon />} />
                  <AttachmentOption label="Add images" hint="PNG, JPG, and more" onClick={() => choosePicker(fileInputRefs.images)} icon={<ImageIcon />} />
                  <AttachmentOption label="Add audio" hint="Audio recordings" onClick={() => choosePicker(fileInputRefs.audio)} icon={<AudioIcon />} />
                </div>
              )}
              <input ref={fileInputRefs.files} type="file" multiple hidden onChange={event => { addFiles(event.target.files); event.currentTarget.value = '' }} />
              <input ref={fileInputRefs.images} type="file" accept="image/*" multiple hidden onChange={event => { addFiles(event.target.files); event.currentTarget.value = '' }} />
              <input ref={fileInputRefs.audio} type="file" accept="audio/*" multiple hidden onChange={event => { addFiles(event.target.files); event.currentTarget.value = '' }} />
            </div>
            <button type="button" className="pv-codex-access-control" onClick={() => onUnavailable('Workspace access is not available yet.')}>
              <ShieldIcon />
              <span>Full access</span>
            </button>
            <span className="pv-codex-control-spacer" />
            <button type="button" className="pv-codex-model-control" onClick={() => onUnavailable('Model selection is not available yet.')}>
              PAYVORA AI <span>Balanced</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5.5L8 10.5l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="pv-codex-control-icon" aria-label={voiceActive ? 'Stop voice input' : 'Voice input'} aria-pressed={voiceActive} onClick={() => { void toggleVoiceInput() }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="5.2" y="1.2" width="5.6" height="8.4" rx="2.8" stroke="currentColor" strokeWidth="1.5"/><path d="M2.8 8a5.2 5.2 0 0010.4 0M8 13.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <button type="submit" className="pv-codex-send" aria-label="Send message" disabled={!message.trim()}>
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

function CodexMark() {
  return <svg className="pv-codex-mark" width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden="true"><path d="M18.4 12.7c4.6-4.1 11.7-4.1 16.3 0 4.8-1.7 10.1.8 12 5.6 4.7 2.1 6.8 7.6 4.7 12.3 2.1 4.7 0 10.2-4.7 12.3-1.9 4.8-7.2 7.3-12 5.6-4.6 4.1-11.7 4.1-16.3 0-4.8 1.7-10.1-.8-12-5.6-4.7-2.1-6.8-7.6-4.7-12.3-2.1-4.7 0-10.2 4.7-12.3 1.9-4.8 7.2-7.3 12-5.6Z" stroke="currentColor" strokeWidth="3.3" strokeLinejoin="round"/><path d="M20.5 29h5.8M33.2 29H38M24.4 22.9 20.5 29l3.9 6.1M33.2 35.1l3.9-6.1-3.9-6.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: 'linear-gradient(135deg, var(--pv-blue), color-mix(in srgb, var(--pv-blue), #000 30%))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function SideRow({ label, icon, active, onClick, ariaExpanded }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; ariaExpanded?: boolean }) {
  return (
    <button type="button" aria-label={label} aria-expanded={ariaExpanded} onClick={onClick}
      className="payvora-side-item"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 12px', borderRadius: 16, border: 'none', background: active ? 'var(--pv-hover)' : 'transparent', color: 'var(--pv-text)', fontSize: 16, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background 160ms ease' }}>
      <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--pv-text)' }}>{icon}</span>
      {label}
    </button>
  )
}

function HomePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ animation: 'payvora-menu-in 260ms cubic-bezier(0.32,0.72,0,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 10px' }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--pv-text)', letterSpacing: '-0.01em' }}>{title}</span>
        <button type="button" aria-label={`Close ${title}`} onClick={onClose}
          style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="var(--pv-text)" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>
      {children}
    </div>
  )
}

function ActionRow({ icon, label, onClick, muted, title }: { icon: React.ReactNode; label: string; onClick?: () => void; muted?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} aria-disabled={muted || undefined} title={title}
      className="payvora-side-item"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 10px', borderRadius: 16, border: 'none', background: 'transparent', color: 'var(--pv-text)', fontSize: 17, fontWeight: 400, cursor: muted ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: muted ? 0.45 : 1, transition: 'background 160ms ease' }}>
      <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--pv-text-secondary)' }}>{icon}</span>
      {label}
      {muted && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--pv-text-muted)' }}>Not available yet</span>}
    </button>
  )
}

function AttachmentOption({ label, hint, icon, onClick }: { label: string; hint: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 0, borderRadius: 11, background: 'transparent', color: 'var(--pv-text)', cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={event => { event.currentTarget.style.background = 'var(--pv-hover)' }}
      onMouseLeave={event => { event.currentTarget.style.background = 'transparent' }}>
      <span aria-hidden style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 9, background: 'var(--pv-hover)', color: 'var(--pv-text-secondary)', flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'block', marginTop: 2, color: 'var(--pv-text-muted)', fontSize: 11 }}>{hint}</span>
      </span>
    </button>
  )
}

function FileIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 2.8h6l4 4V17H5V2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M11 2.8v4h4M7.5 10h5M7.5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
}

function ImageIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2.8" y="3.5" width="14.4" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="7" cy="7.5" r="1.2" stroke="currentColor" strokeWidth="1.3"/><path d="m4.5 14 3.4-3.4 2.5 2.4 1.8-1.7 3.3 3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function AudioIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="7" y="2.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7.5 17.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
}

const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', padding: '9px 10px', border: 'none', borderRadius: 12, background: 'transparent', color: 'var(--pv-text)', fontSize: 13, fontWeight: 400, textAlign: 'left', cursor: 'pointer', transition: 'background 180ms ease, color 180ms ease',
}
const pillIconBtn: React.CSSProperties = {
  width: 42, height: 42, borderRadius: 21, border: 'none', background: 'var(--pv-card-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--pv-pill-shadow)', flexShrink: 0,
}
const barIconBtn: React.CSSProperties = {
  width: 38, height: 38, background: 'none', border: 'none', borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

// ── Icons (ChatGPT-style, 1.6–1.8 stroke) ─────────────────────────────────

function ProjectsIcon() { return <svg width="21" height="21" viewBox="0 0 22 22" fill="none"><path d="M2.5 6A2.5 2.5 0 015 3.5h3.2c.7 0 1.3.3 1.8.8l1 1.2h5A2.5 2.5 0 0118.5 8v8A2.5 2.5 0 0116 18.5H5A2.5 2.5 0 012.5 16V6z" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg> }
function HomeIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M3 8.5L10 3l7 5.5V16a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16V8.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M7.5 17.5v-5h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> }
function WaveIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M3 8v4M6.5 5.5v9M10 3v14M13.5 6v8M17 8.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg> }
function GridIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6"/></svg> }
function PlugIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M7 3v4M13 3v4M5.5 7h9v3a4.5 4.5 0 01-9 0V7zM10 14.5V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function PencilIcon() { return <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M14.5 3.5a2.4 2.4 0 013.4 3.4L7 17.8l-4.5 1.1L3.6 14.5 14.5 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> }
function GlobeIcon() { return <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.6"/><path d="M11 2.5c-3 3.5-3 13.5 0 17M11 2.5c3 3.5 3 13.5 0 17M2.5 11h17" stroke="currentColor" strokeWidth="1.4"/></svg> }
function ReviewIcon() { return <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M17.6 4.4a8.6 8.6 0 10.7 10.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M18.3 2.9v4.7h-4.7M7.4 11l2.2 2.2 4.9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function BugIcon() { return <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="6.7" y="6.5" width="8.6" height="10.4" rx="4.3" stroke="currentColor" strokeWidth="1.6"/><path d="M11 3.2v3M5 9H3.3M5 13H3.3M17 9h1.7M17 13h1.7M7 4.5l-1.5-1.4M15 4.5l1.5-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> }
function ShieldIcon() { return <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 2.4 14.4 4v4.4c0 3.2-2.2 5.7-5.4 7.2-3.2-1.5-5.4-4-5.4-7.2V4L9 2.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> }
