import type { CSSProperties } from 'react'

type PayvoraLogoProps = {
  size?: number
  color?: string
  showWordmark?: boolean
  showTagline?: boolean
  className?: string
}

const markPoints = (size: number) => {
  const scale = size / 200
  const point = (x: number, y: number) => `${(x * scale).toFixed(2)},${(y * scale).toFixed(2)}`
  return {
    upperLeft: [point(30.72, 60), point(100, 20), point(90, 82.68)].join(' '),
    right: [point(169.28, 60), point(169.28, 140), point(122, 100)].join(' '),
    lowerLeft: [point(100, 180), point(30.72, 140), point(90, 117.32)].join(' '),
  }
}

export function PayvoraMark({ size = 48, color = '#e8edf5' }: { size?: number; color?: string }) {
  const points = markPoints(size)
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="PAYVORA geometric mark"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <polygon points={points.upperLeft} fill={color} />
      <polygon points={points.right} fill={color} />
      <polygon points={points.lowerLeft} fill={color} />
    </svg>
  )
}

export function PayvoraLogo({
  size = 42,
  color = 'var(--pv-text)',
  showWordmark = true,
  showTagline = false,
  className,
}: PayvoraLogoProps) {
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <PayvoraMark size={size} color={color} />
      {showWordmark && (
        <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
          <span style={{
            color,
            fontFamily: "'Outfit', Inter, sans-serif",
            fontSize: Math.max(16, size * 0.46),
            fontWeight: 300,
            letterSpacing: '0.28em',
            lineHeight: 1,
            paddingLeft: '0.28em',
            whiteSpace: 'nowrap',
          }}>
            PAYVORA
          </span>
          {showTagline && (
            <span style={{
              color: 'var(--pv-text-muted)',
              fontFamily: "'Outfit', Inter, sans-serif",
              fontSize: Math.max(7, size * 0.14),
              fontWeight: 300,
              letterSpacing: '0.32em',
              lineHeight: 1.2,
              paddingLeft: '0.32em',
              whiteSpace: 'nowrap',
            }}>
              THE ARCHITECTURE OF MODERN FINANCE
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function PayvoraLoader({ fullscreen = false, label = 'Loading' }: { fullscreen?: boolean; label?: string }) {
  const shell: CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: '#060a14' }
    : { display: 'inline-grid', placeItems: 'center', padding: 16 }
  return (
    <div className={fullscreen ? 'payvora-loader payvora-loader--fullscreen' : 'payvora-loader'} style={shell} role="status" aria-live="polite" aria-label={label}>
      <div className="payvora-loader__grid" aria-hidden>
        <PayvoraMark size={fullscreen ? 112 : 42} color="#e8edf5" />
      </div>
      {fullscreen && (
        <div className="payvora-loader__copy">
          <div className="payvora-loader__wordmark">PAYVORA</div>
          <div className="payvora-loader__tagline">THE ARCHITECTURE OF MODERN FINANCE</div>
        </div>
      )}
    </div>
  )
}