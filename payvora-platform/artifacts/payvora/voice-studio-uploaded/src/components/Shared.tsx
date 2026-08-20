import { useState } from 'react'
import { C } from '@/tokens'

// ── Play button for Recent Generations (bold, hover→purple) ──────────────────
export function PlayButton({ size = 36 }: { size?: number }) {
  const [h, setH] = useState(false)
  const stroke = 2.5
  const cx = size / 2
  const tw = size * 0.28, th = size * 0.32
  const tx = cx - tw * 0.38, ty = cx - th / 2
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `${stroke}px solid ${h ? C.accent : C.black}`,
        background: h ? C.accentLight : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        transition: 'all 0.15s',
        boxShadow: h ? '0 4px 12px rgba(100,65,224,0.18)' : 'none',
        padding: 0,
      }}
      aria-label="Play"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <polygon points={`${tx},${ty} ${tx+tw},${ty+th/2} ${tx},${ty+th}`} fill={h ? C.accent : C.black} style={{ transition: 'fill 0.15s' }} />
      </svg>
    </button>
  )
}

// ── Voice card play button (light, minimal, bottom-right) ────────────────────
export function VoiceCardPlayButton() {
  const size = 34
  const [h, setH] = useState(false)
  const cx = size / 2
  const tw = size * 0.24, th = size * 0.28
  const tx = cx - tw * 0.3, ty = cx - th / 2
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={e => e.stopPropagation()}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `1.5px solid ${h ? C.accent : '#D7DCE6'}`,
        background: h ? C.accentLight : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        transition: 'all 0.15s',
        boxShadow: h ? '0 2px 8px rgba(100,65,224,0.14)' : 'none',
      }}
      aria-label="Play preview"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <polygon points={`${tx},${ty} ${tx+tw},${ty+th/2} ${tx},${ty+th}`} fill={h ? C.accent : C.black} style={{ transition: 'fill 0.15s' }} />
      </svg>
    </div>
  )
}

// ── Audio waveform icon (5 bars) ─────────────────────────────────────────────
export function WaveformIcon({ size = 22, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 22 18" fill="none">
      <rect x="0"     y="6" width="3" height="6"  rx="1.5" fill={color} />
      <rect x="4.75"  y="3" width="3" height="12" rx="1.5" fill={color} />
      <rect x="9.5"   y="0" width="3" height="18" rx="1.5" fill={color} />
      <rect x="14.25" y="3" width="3" height="12" rx="1.5" fill={color} />
      <rect x="19"    y="6" width="3" height="6"  rx="1.5" fill={color} />
    </svg>
  )
}

// ── Decorative mini waveform for cards ───────────────────────────────────────
const BARS = [3,5,9,14,18,22,26,22,30,24,18,14,10,7,5,3,8,13,20,26,22,16,11,7,4,3,6,10]
export function MiniWaveform({ active = false, h = 28 }: { active?: boolean; h?: number }) {
  const W = BARS.length * 4
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      {BARS.map((bh, i) => {
        const scaled = (bh / 30) * h
        return <rect key={i} x={i*4} y={(h-scaled)/2} width="2.5" height={scaled} rx="1.25" fill={active ? C.accent : C.border} />
      })}
    </svg>
  )
}

// ── Slider ───────────────────────────────────────────────────────────────────
export function Slider({ value, max = 100 }: { value: number; max?: number }) {
  const pct = (value / max) * 100
  return (
    <div style={{ position: 'relative', height: 6, width: '100%', borderRadius: 3, background: C.borderLight, cursor: 'pointer' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, width: `${pct}%`, background: C.accent }} />
      <div style={{ position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)', left: `${pct}%`, width: 14, height: 14, borderRadius: '50%', border: '2px solid white', background: C.accent, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked }: { checked: boolean }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 40, height: 22, borderRadius: 11, cursor: 'pointer', background: checked ? C.accent : C.border, transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', width: 14, height: 14, background: C.white, borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'transform 0.2s', transform: checked ? 'translateX(20px)' : 'translateX(4px)' }} />
    </div>
  )
}

// ── Select dropdown ──────────────────────────────────────────────────────────
export function SelectDropdown({ value }: { value: string }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 14, color: C.black, cursor: 'pointer', minWidth: 110, background: C.white, transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
      onMouseLeave={e => (e.currentTarget.style.background = C.white)}
    >
      <span style={{ fontWeight: 500 }}>{value}</span>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 8, color: C.textGray }}>
        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────
type StatusType = 'active' | 'completed' | 'processing' | 'failed' | 'queued'
const STATUS_MAP: Record<StatusType, { label: string; color: string; bg: string }> = {
  active:     { label: 'Active',     color: C.green,  bg: C.greenBg  },
  completed:  { label: 'Completed',  color: C.green,  bg: C.greenBg  },
  processing: { label: 'Processing', color: C.accent, bg: C.accentLight },
  failed:     { label: 'Failed',     color: C.red,    bg: C.redBg    },
  queued:     { label: 'Queued',     color: C.orange, bg: C.orangeBg },
}
export function StatusBadge({ status }: { status: StatusType }) {
  const s = STATUS_MAP[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', color: s.color, background: s.bg, borderRadius: 20, padding: '3px 8px' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  )
}

// ── Gender badge ─────────────────────────────────────────────────────────────
export function GenderBadge({ gender }: { gender: string }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, borderRadius: 20, padding: '2px 8px' }}>
      {gender}
    </span>
  )
}

// ── Circular icon button ─────────────────────────────────────────────────────
export function IconBtn({ children, title, danger = false, onClick }: { children: React.ReactNode; title?: string; danger?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: h ? (danger ? C.redBg : C.accentLight) : 'transparent', color: h ? (danger ? C.red : C.accent) : C.textGray, transition: 'all 0.15s', padding: 0 }}
    >
      {children}
    </button>
  )
}

// ── Section heading ──────────────────────────────────────────────────────────
export function SectionHeading({ title, action, actionLabel }: { title: string; action?: () => void; actionLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>{title}</h2>
      {action && (
        <button onClick={action} style={{ fontSize: 13, fontWeight: 500, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ── Pill filter button ───────────────────────────────────────────────────────
export function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: active ? C.accentLight : 'transparent', color: active ? C.accent : C.textGray }}
    >
      {label}
    </button>
  )
}

// ── Search bar ───────────────────────────────────────────────────────────────
export function SearchBar({ placeholder = 'Search...', value, onChange }: { placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, borderRadius: 12, border: `1px solid #E8EAF1`, background: C.white, padding: '0 14px', flex: 1 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textGray} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: C.black, background: 'transparent' }}
      />
    </div>
  )
}

// ── Card wrapper ─────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  )
}

// ── Divider ──────────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ height: 1, background: C.borderLight, margin: '12px 0' }} />
}
