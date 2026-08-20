import { useEffect, useId, useRef, useState } from 'react'
import { C } from '../tokens'

type PlayVisualState = 'idle' | 'loading' | 'playing' | 'paused'

function PlayPauseGlyph({ size, state, color }: { size: number; state: PlayVisualState; color: string }) {
  const cx = size / 2
  if (state === 'loading') {
    return (
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" style={{ animation: 'payvora-spin 0.8s linear infinite' }} aria-hidden>
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.5" strokeDasharray="42" strokeDashoffset="14" strokeLinecap="round" />
      </svg>
    )
  }
  if (state === 'playing') {
    const bw = size * 0.09, bh = size * 0.3, gap = size * 0.08
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
        <rect x={cx - gap - bw} y={cx - bh / 2} width={bw} height={bh} rx={bw / 2} fill={color} />
        <rect x={cx + gap} y={cx - bh / 2} width={bw} height={bh} rx={bw / 2} fill={color} />
      </svg>
    )
  }
  const tw = size * 0.28, th = size * 0.32
  const tx = cx - tw * 0.38, ty = cx - th / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={`${tx},${ty} ${tx + tw},${ty + th / 2} ${tx},${ty + th}`} fill={color} style={{ transition: 'fill 0.15s' }} />
    </svg>
  )
}

// ── Play button for Recent Generations (bold, hover→purple) ──────────────────
export function PlayButton({ size = 36, state = 'idle', onClick, label = 'Play' }: { size?: number; state?: PlayVisualState; onClick?: (e: React.MouseEvent) => void; label?: string }) {
  const [h, setH] = useState(false)
  const active = state === 'playing' || state === 'loading' || state === 'paused'
  const color = h || active ? C.accent : C.black
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      disabled={state === 'loading'}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `2.5px solid ${color}`,
        background: h || active ? C.accentLight : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: state === 'loading' ? 'wait' : 'pointer', flexShrink: 0,
        transition: 'all 0.15s',
        boxShadow: h ? '0 4px 12px rgba(100,65,224,0.18)' : 'none',
        padding: 0,
      }}
      aria-label={state === 'playing' ? 'Pause' : label}
      aria-pressed={state === 'playing'}
    >
      <PlayPauseGlyph size={size} state={state} color={color} />
    </button>
  )
}

// ── Voice card play button (light, minimal, bottom-right) ────────────────────
export function VoiceCardPlayButton({ state = 'idle', onClick, label = 'Play preview' }: { state?: PlayVisualState; onClick?: (e: React.MouseEvent) => void; label?: string }) {
  const size = 34
  const [h, setH] = useState(false)
  const active = state === 'playing' || state === 'loading' || state === 'paused'
  const color = h || active ? C.accent : C.black
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick?.(e) }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      disabled={state === 'loading'}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `1.5px solid ${h || active ? C.accent : '#D7DCE6'}`,
        background: h || active ? C.accentLight : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: state === 'loading' ? 'wait' : 'pointer', flexShrink: 0,
        transition: 'all 0.15s',
        boxShadow: h ? '0 2px 8px rgba(100,65,224,0.14)' : 'none',
        padding: 0,
      }}
      aria-label={state === 'playing' ? 'Pause preview' : label}
      aria-pressed={state === 'playing'}
    >
      <PlayPauseGlyph size={size} state={state} color={color} />
    </button>
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

// ── Slider — real accessible range control (keyboard, touch, mouse) ──────────
export function Slider({ value, min = 0, max = 100, step = 1, onChange, label, disabled = false, disabledReason }: {
  value: number; min?: number; max?: number; step?: number
  onChange?: (v: number) => void; label?: string
  disabled?: boolean; disabledReason?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ position: 'relative', height: 20, width: '100%', display: 'flex', alignItems: 'center', opacity: disabled ? 0.45 : 1 }} title={disabled ? disabledReason : undefined}>
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, background: C.borderLight, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, width: `${pct}%`, background: C.accent }} />
        <div style={{ position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)', left: `${pct}%`, width: 14, height: 14, borderRadius: '50%', border: '2px solid white', background: C.accent, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
      </div>
      <input
        type="range"
        className="payvora-range"
        min={min} max={max} step={step} value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        onChange={e => onChange?.(Number(e.target.value))}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer', margin: 0, touchAction: 'pan-y' }}
      />
    </div>
  )
}

// ── Toggle — real switch (role=switch, keyboard, click) ─────────────────────
export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange?: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 40, height: 22, borderRadius: 11, cursor: disabled ? 'not-allowed' : 'pointer', background: checked ? C.accent : C.border, transition: 'background 0.2s', flexShrink: 0, border: 'none', padding: 0, opacity: disabled ? 0.45 : 1 }}
    >
      <span style={{ position: 'absolute', width: 14, height: 14, background: C.white, borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'transform 0.2s', transform: checked ? 'translateX(20px)' : 'translateX(4px)' }} />
    </button>
  )
}

// ── Select dropdown — native select styled to match the design ──────────────
export function SelectDropdown({ value, options, onChange, label, disabled = false, disabledReason }: {
  value: string
  options?: { value: string; label: string }[]
  onChange?: (v: string) => void
  label?: string
  disabled?: boolean
  disabledReason?: string
}) {
  const id = useId()
  const opts = options ?? [{ value, label: value }]
  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 14, color: C.black, cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 110, background: C.white, transition: 'background 0.15s', opacity: disabled ? 0.55 : 1 }}
      title={disabled ? disabledReason : undefined}
    >
      <span style={{ fontWeight: 500, pointerEvents: 'none' }}>{opts.find(o => o.value === value)?.label ?? value}</span>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 8, color: C.textGray, pointerEvents: 'none' }} aria-hidden>
        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        id={id}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.value)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Confirm dialog — accessible destructive-action confirmation ─────────────
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; busy?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) confirmRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div role="presentation" onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: 14, color: C.textGray, margin: '0 0 20px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} disabled={busy} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 14, fontWeight: 500, color: C.black, cursor: 'pointer' }}>Cancel</button>
          <button ref={confirmRef} onClick={onConfirm} disabled={busy} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.red, fontSize: 14, fontWeight: 600, color: C.white, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
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
