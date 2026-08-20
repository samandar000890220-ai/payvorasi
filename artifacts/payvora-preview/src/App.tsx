import { useState } from 'react'

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:        '#060a14',
  bg2:       '#0b1221',
  cobalt:    '#0e1c3a',
  cobaltMid: '#162b58',
  electric:  '#3b55f5',
  platinum:  '#e8edf5',
  platDim:   '#bbc6d6',
  slate:     '#6f80a0',
  slateDim:  '#4a5770',
  gold:      '#c49a52',
  goldLight: '#d4b16a',
  line:      'rgba(255,255,255,0.07)',
  lineGold:  'rgba(196,154,82,0.3)',
}

// ── PAYVORA MARK ───────────────────────────────────────────────────────────
//
// Geometric concept: "The Trident Node"
//
// A regular hexagon (R=80) with a pointy-top orientation serves as the
// bounding silhouette. Three bold triangular fins occupy alternating thirds
// of the hexagon (at the upper-left, right, and lower-left edges), each fin
// converging toward a shared central void. The void is a small equilateral
// triangle (r=20 from center), and the three gaps between fins radiate
// outward to the opposite edges, forming a Y-shaped negative space channel.
//
// Reading: convergence of value flows, stability (3-fold symmetry),
// precision engineering, and a kinetic rotational energy — without
// referencing any letter, symbol, or generic fintech motif.

function PayvoraMark({
  size = 200,
  color = T.platinum,
  bg = 'transparent',
  rounded = false,
  animated = false,
}: {
  size?: number
  color?: string
  bg?: string
  rounded?: boolean
  animated?: boolean
}) {
  const R = 80    // hexagon circumradius
  const vr = 22  // inner void circumradius from center
  const cx = 100, cy = 100

  // Hexagon vertices — pointy-top, clockwise, V0=top
  // Vk = (cx + R·sin(k·60°), cy − R·cos(k·60°))
  const s = (deg: number) => Math.sin((deg * Math.PI) / 180)
  const c = (deg: number) => Math.cos((deg * Math.PI) / 180)
  const V = [0, 1, 2, 3, 4, 5].map((k) => ({
    x: cx + R * s(k * 60),
    y: cy - R * c(k * 60),
  }))
  // V[0]=(100, 20)  V[1]=(169.3, 60)  V[2]=(169.3,140)
  // V[3]=(100,180)  V[4]=( 30.7,140)  V[5]=( 30.7, 60)

  // Void triangle vertices — equilateral, centroid at (cx,cy)
  // Placed at 240°, 0°, 120° from center (SVG angle convention: CW from right)
  // Each tip sits directly across from its fin's base edge (non-rotational)
  const tip = (deg: number) => ({
    x: cx + vr * c(deg),
    y: cy + vr * s(deg),
  })
  const t1 = tip(240) // (90,   82.7)  — upper-left of center (W1's tip)
  const t2 = tip(0)   // (122,  100)   — right of center       (W2's tip)
  const t3 = tip(120) // (90,  117.3)  — lower-left of center  (W3's tip)

  // Three fins — each fin = one hexagon edge + the opposite void vertex
  // Fin A: upper-left edge (V5→V0), tip t1
  // Fin B: right edge (V1→V2),       tip t2
  // Fin C: lower-left edge (V3→V4),  tip t3
  const pts = (p: { x: number; y: number }[]) =>
    p.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ')

  const delay = (n: number) => (animated ? `${n}s` : '0s')
  const finStyle = (i: number) =>
    animated
      ? ({
          opacity: 0,
          transform: 'scale(0.6)',
          transformOrigin: `${cx}px ${cy}px`,
          animation: `bloomFin 0.55s cubic-bezier(0.34,1.28,0.64,1) ${delay(0.3 + i * 0.12)} forwards`,
        } as React.CSSProperties)
      : undefined

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-label="Payvora symbol"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {rounded && (
        <rect x="0" y="0" width="200" height="200" rx="46" fill={bg} />
      )}
      {/* Fin A — upper-left */}
      <polygon
        points={pts([V[5], V[0], t1])}
        fill={color}
        style={finStyle(0)}
      />
      {/* Fin B — right */}
      <polygon
        points={pts([V[1], V[2], t2])}
        fill={color}
        style={finStyle(1)}
      />
      {/* Fin C — lower-left */}
      <polygon
        points={pts([V[3], V[4], t3])}
        fill={color}
        style={finStyle(2)}
      />
    </svg>
  )
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.42em',
        color: T.gold,
        textTransform: 'uppercase',
        marginBottom: '56px',
        paddingLeft: '0.42em',
      }}
    >
      {children}
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 120px',
        position: 'relative',
        overflow: 'hidden',
        background: T.bg,
      }}
    >
      {/* Precision grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${T.line} 1px, transparent 1px), linear-gradient(90deg, ${T.line} 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          backgroundPosition: 'center center',
          pointerEvents: 'none',
        }}
      />
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 55% 55% at 50% 44%, rgba(59,85,245,0.1) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
        {/* Mark */}
        <div
          style={{
            marginBottom: '52px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <PayvoraMark size={172} animated />
        </div>

        {/* Wordmark */}
        <h1
          style={{
            fontSize: 'clamp(30px,5.5vw,68px)',
            fontWeight: 200,
            letterSpacing: '0.3em',
            color: T.platinum,
            textTransform: 'uppercase',
            fontFamily: "'Outfit', sans-serif",
            margin: '0 0 18px',
            paddingLeft: '0.3em',
            animation: 'slideUp 0.9s ease 0.9s both',
          }}
        >
          Payvora
        </h1>

        <p
          style={{
            fontSize: 'clamp(9px,1.1vw,12px)',
            fontWeight: 300,
            letterSpacing: '0.45em',
            color: T.slate,
            textTransform: 'uppercase',
            margin: 0,
            paddingLeft: '0.45em',
            animation: 'slideUp 0.9s ease 1.1s both',
          }}
        >
          The Architecture of Modern Finance
        </p>

        <div
          style={{
            width: '28px',
            height: '1px',
            background: T.gold,
            margin: '40px auto 0',
            animation: 'fadeIn 0.6s ease 1.4s both',
          }}
        />
      </div>

      {/* Scroll cue */}
      <div
        style={{
          position: 'absolute',
          bottom: '44px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          opacity: 0,
          animation: 'fadeIn 0.6s ease 2s forwards',
        }}
      >
        <div style={{ width: '1px', height: '36px', background: T.slateDim }} />
        <span
          style={{
            fontSize: '8px',
            letterSpacing: '0.35em',
            color: T.slateDim,
            textTransform: 'uppercase',
          }}
        >
          Scroll
        </span>
      </div>
    </section>
  )
}

// ── Mark Anatomy ───────────────────────────────────────────────────────────
function AnatomySection() {
  return (
    <section
      style={{
        padding: 'clamp(80px,11vw,150px) clamp(24px,8vw,120px)',
        background: T.bg2,
        borderTop: `1px solid ${T.line}`,
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionLabel>Symbol Anatomy</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '64px',
            alignItems: 'center',
          }}
        >
          {/* Large mark on muted ground */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${T.line}`,
            }}
          >
            <PayvoraMark size={220} />
          </div>

          {/* Annotation list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {[
              {
                num: '01',
                head: 'Hexagonal Silhouette',
                body: 'The hexagon — found in crystal lattices, financial networks, and honeycomb structures — anchors the form. Its six-fold potential reduced to three active fins communicates selective precision.',
              },
              {
                num: '02',
                head: 'Three Convergent Fins',
                body: 'Each triangular fin originates at an outer edge and converges toward a shared interior node. Three flows — capital, data, trust — meeting at a single settlement point.',
              },
              {
                num: '03',
                head: 'The Y-Channel Void',
                body: 'The negative space between fins forms a branching Y-channel — the hidden network routing layer, invisible infrastructure made legible through absence.',
              },
            ].map((a) => (
              <div key={a.num} style={{ display: 'flex', gap: '24px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.2em',
                    color: T.gold,
                    marginTop: '2px',
                    flexShrink: 0,
                    width: '28px',
                  }}
                >
                  {a.num}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 400,
                      color: T.platinum,
                      marginBottom: '8px',
                    }}
                  >
                    {a.head}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 300,
                      lineHeight: 1.75,
                      color: T.slate,
                    }}
                  >
                    {a.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Brand Essence ──────────────────────────────────────────────────────────
function EssenceSection() {
  const pillars = [
    {
      label: 'Precision',
      desc: 'Every transaction engineered to exact tolerances. Sub-100ms global settlement where milliseconds define institutional reliability.',
    },
    {
      label: 'Flow',
      desc: 'Capital moves at the speed of thought across borders, currencies, and institutions — frictionless by design, not by accident.',
    },
    {
      label: 'Trust',
      desc: 'A foundation built on cryptographic certainty, ISO 27001 compliance, and a decade of zero-breach infrastructure.',
    },
  ]

  return (
    <section
      style={{
        padding: 'clamp(80px,11vw,150px) clamp(24px,8vw,120px)',
        background: T.bg,
        borderTop: `1px solid ${T.line}`,
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionLabel>Brand Essence</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1px',
            background: T.line,
          }}
        >
          {pillars.map((p, i) => (
            <div
              key={p.label}
              style={{
                background: T.bg,
                padding: 'clamp(32px,4vw,56px) clamp(24px,3vw,44px)',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.3em',
                  color: T.gold,
                  textTransform: 'uppercase',
                  marginBottom: '20px',
                  paddingLeft: '0.3em',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                style={{
                  fontSize: 'clamp(20px,2.2vw,26px)',
                  fontWeight: 300,
                  letterSpacing: '0.04em',
                  color: T.platinum,
                  marginBottom: '18px',
                }}
              >
                {p.label}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 300,
                  lineHeight: 1.75,
                  color: T.slate,
                }}
              >
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Color System ───────────────────────────────────────────────────────────
function ColorSection() {
  const palette = [
    { name: 'Deep Space',   hex: '#060A14', swatch: T.bg,      usage: 'Primary Background',  bordered: true  },
    { name: 'Cobalt Night', hex: '#0E1C3A', swatch: T.cobalt,  usage: 'Secondary Surface',   bordered: false },
    { name: 'Electric',     hex: '#3B55F5', swatch: T.electric, usage: 'Brand Action',        bordered: false },
    { name: 'Platinum',     hex: '#E8EDF5', swatch: T.platinum, usage: 'Primary Text',        bordered: false },
    { name: 'Slate',        hex: '#6F80A0', swatch: T.slate,    usage: 'Secondary Text',      bordered: false },
    { name: 'Gold',         hex: '#C49A52', swatch: T.gold,     usage: 'Premium Accent',      bordered: false },
  ]

  return (
    <section
      style={{
        padding: 'clamp(80px,11vw,150px) clamp(24px,8vw,120px)',
        background: T.bg2,
        borderTop: `1px solid ${T.line}`,
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionLabel>Color System</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
            gap: '28px',
          }}
        >
          {palette.map((c) => (
            <div key={c.name}>
              <div
                style={{
                  height: '88px',
                  background: c.swatch,
                  marginBottom: '14px',
                  border: c.bordered ? `1px solid ${T.line}` : 'none',
                }}
              />
              <div style={{ fontSize: '13px', fontWeight: 500, color: T.platinum, marginBottom: '4px' }}>
                {c.name}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 400, color: T.slate, letterSpacing: '0.08em', marginBottom: '3px' }}>
                {c.hex}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 300, color: T.slateDim }}>
                {c.usage}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Mark Variations ────────────────────────────────────────────────────────
function MarkVariantsSection() {
  const variants = [
    { label: 'Primary Dark',    cellBg: T.bg,        markColor: T.platinum, bordered: true  },
    { label: 'Cobalt',          cellBg: T.cobalt,    markColor: T.platinum, bordered: false },
    { label: 'Electric',        cellBg: T.electric,  markColor: '#ffffff',  bordered: false },
    { label: 'Inverse Light',   cellBg: '#eef1f7',   markColor: T.cobalt,   bordered: false },
    { label: 'Gold Mono',       cellBg: T.bg2,       markColor: T.gold,     bordered: false },
    { label: 'Platinum Field',  cellBg: T.platinum,  markColor: T.cobalt,   bordered: false },
  ]

  return (
    <section
      style={{
        padding: 'clamp(80px,11vw,150px) clamp(24px,8vw,120px)',
        background: T.bg,
        borderTop: `1px solid ${T.line}`,
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionLabel>Mark Variations</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1px',
            background: T.line,
          }}
        >
          {variants.map((v) => (
            <div
              key={v.label}
              style={{
                background: v.cellBg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 20px',
                gap: '20px',
                border: v.bordered ? `1px solid ${T.line}` : 'none',
              }}
            >
              <PayvoraMark size={68} color={v.markColor} />
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 400,
                  letterSpacing: '0.22em',
                  color:
                    v.label.includes('Light') || v.label.includes('Platinum')
                      ? T.slateDim
                      : 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                  paddingLeft: '0.22em',
                }}
              >
                {v.label}
              </span>
            </div>
          ))}
        </div>

        {/* App icon row */}
        <div style={{ marginTop: '48px' }}>
          <div
            style={{
              fontSize: '10px',
              color: T.slate,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginBottom: '24px',
            }}
          >
            App Icon · Favicon
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {[
              { sz: 96, bg: T.cobalt, label: '96px' },
              { sz: 64, bg: T.cobalt, label: '64px' },
              { sz: 48, bg: T.cobalt, label: '48px' },
              { sz: 32, bg: T.cobalt, label: '32px' },
              { sz: 20, bg: T.cobalt, label: '20px' },
              { sz: 16, bg: T.cobalt, label: '16px' },
            ].map(({ sz, bg, label }) => (
              <div key={sz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <PayvoraMark size={sz} color={T.platinum} bg={bg} rounded />
                <span style={{ fontSize: '9px', color: T.slateDim, letterSpacing: '0.1em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Typography ─────────────────────────────────────────────────────────────
function TypographySection() {
  const scale = [
    { role: 'Display · 200',  size: 'clamp(40px,6vw,80px)', weight: 200, text: 'Global Infrastructure', ls: '-0.01em' },
    { role: 'Heading · 300',  size: 'clamp(24px,3vw,38px)', weight: 300, text: 'Enterprise Settlements', ls: '0'       },
    { role: 'Subhead · 400',  size: '20px',                  weight: 400, text: 'Institutional Liquidity', ls: '0'     },
    { role: 'Body · 300',     size: '15px',                  weight: 300, text: 'Real-time capital flows across 140 jurisdictions.', ls: '0' },
    { role: 'Label · 500',    size: '11px',                  weight: 500, text: 'TRANSACTION STATUS',      ls: '0.25em' },
  ]

  return (
    <section
      style={{
        padding: 'clamp(80px,11vw,150px) clamp(24px,8vw,120px)',
        background: T.bg2,
        borderTop: `1px solid ${T.line}`,
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionLabel>Typography · Outfit</SectionLabel>

        <div style={{ marginBottom: 'clamp(48px,7vw,96px)' }}>
          <p style={{ fontSize: '10px', color: T.slate, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Outfit · Weight 200 · Display
          </p>
          <h2
            style={{
              fontSize: 'clamp(44px,8vw,104px)',
              fontWeight: 200,
              lineHeight: 0.95,
              color: T.platinum,
              margin: 0,
              letterSpacing: '-0.015em',
            }}
          >
            Financial<br />Infrastructure
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '48px 80px',
            marginBottom: 'clamp(48px,7vw,80px)',
          }}
        >
          <div>
            <p style={{ fontSize: '10px', color: T.slate, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Weight 300</p>
            <p style={{ fontSize: 'clamp(17px,2vw,22px)', fontWeight: 300, lineHeight: 1.5, color: T.platinum, margin: 0 }}>
              Move capital across any border with institutional precision and consumer simplicity.
            </p>
          </div>
          <div>
            <p style={{ fontSize: '10px', color: T.slate, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Weight 400</p>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: 1.8, color: T.platDim, margin: 0 }}>
              Payvora processes over 2.4 million transactions daily across 140 countries. Our infrastructure is built on military-grade cryptographic protocols with sub-100ms settlement times globally.
            </p>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: '40px' }}>
          {scale.map((s, i) => (
            <div
              key={s.role}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '32px',
                padding: '16px 0',
                borderBottom: i < scale.length - 1 ? `1px solid ${T.line}` : 'none',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ width: '160px', flexShrink: 0, fontSize: '10px', color: T.slateDim, letterSpacing: '0.08em' }}>
                {s.role}
              </div>
              <div style={{ fontSize: s.size, fontWeight: s.weight, color: T.platinum, letterSpacing: s.ls, lineHeight: 1.2 }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Applications ───────────────────────────────────────────────────────────
function ApplicationsSection() {
  const [activeTab, setActiveTab] = useState(0)
  const tabs = ['Overview', 'Transfers', 'FX']
  const transactions = [
    { name: 'USD Settlements', amount: '+$124,500', time: 'Today, 09:41', status: 'Completed',  positive: true  },
    { name: 'EUR Transfer',    amount: '-€84,200',  time: 'Today, 08:17', status: 'Processing', positive: false },
    { name: 'JPY Conversion',  amount: '+¥18.4M',   time: 'Yesterday',    status: 'Completed',  positive: true  },
    { name: 'GBP Settlement',  amount: '+£62,000',  time: 'Yesterday',    status: 'Completed',  positive: true  },
  ]

  return (
    <section
      style={{
        padding: 'clamp(80px,11vw,150px) clamp(24px,8vw,120px)',
        background: T.bg,
        borderTop: `1px solid ${T.line}`,
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionLabel>Brand Applications</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Premium card */}
          <div
            style={{
              background: `linear-gradient(148deg, ${T.cobaltMid} 0%, #0e1a36 60%, #0a1228 100%)`,
              borderRadius: '18px',
              padding: '36px',
              border: `1px solid rgba(255,255,255,0.09)`,
              position: 'relative',
              overflow: 'hidden',
              minHeight: '220px',
            }}
          >
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '240px', height: '240px', background: `radial-gradient(circle, rgba(59,85,245,0.18) 0%, transparent 68%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '180px', height: '180px', background: `radial-gradient(circle, rgba(196,154,82,0.08) 0%, transparent 68%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '44px' }}>
                <PayvoraMark size={36} />
                <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.3em', color: T.gold, textTransform: 'uppercase' }}>Elite</span>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 300, letterSpacing: '0.22em', color: T.platinum, marginBottom: '28px' }}>
                4892 &nbsp;·&nbsp; 7741 &nbsp;·&nbsp; 3312 &nbsp;·&nbsp; 9084
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '9px', color: T.slate, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Cardholder</div>
                  <div style={{ fontSize: '13px', fontWeight: 400, color: T.platinum }}>Alexandra Voss</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: T.slate, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Expires</div>
                  <div style={{ fontSize: '13px', fontWeight: 400, color: T.platinum }}>09 / 29</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard widget */}
          <div style={{ background: T.bg2, borderRadius: '18px', border: `1px solid ${T.line}`, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <PayvoraMark size={22} />
              <span style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.18em', color: T.platinum, textTransform: 'uppercase' }}>Payvora</span>
            </div>

            <div style={{ display: 'flex', gap: '0', borderBottom: `1px solid ${T.line}`, padding: '0 24px' }}>
              {tabs.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 16px 10px',
                    fontSize: '11px',
                    fontWeight: 400,
                    letterSpacing: '0.08em',
                    color: activeTab === i ? T.platinum : T.slate,
                    cursor: 'pointer',
                    borderBottom: activeTab === i ? `2px solid ${T.gold}` : '2px solid transparent',
                    transition: 'color 0.15s ease',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ fontSize: '10px', color: T.slate, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>Portfolio Value</div>
              <div style={{ fontSize: '32px', fontWeight: 200, color: T.platinum, lineHeight: 1, marginBottom: '6px' }}>$2,847,340</div>
              <div style={{ fontSize: '12px', fontWeight: 400, color: '#4ade80', marginBottom: '24px' }}>+$47,820 &nbsp;(+1.71%) today</div>

              {transactions.map((tx) => (
                <div key={tx.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: `1px solid ${T.line}` }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: T.platinum, marginBottom: '2px' }}>{tx.name}</div>
                    <div style={{ fontSize: '10px', color: T.slate }}>{tx.time}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 300, color: tx.positive ? '#4ade80' : T.platDim }}>{tx.amount}</div>
                    <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: tx.status === 'Processing' ? T.gold : T.slateDim, marginTop: '2px' }}>{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Light lockup */}
          <div
            style={{
              background: '#eef1f7',
              borderRadius: '18px',
              padding: '52px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '22px',
              minHeight: '260px',
            }}
          >
            <PayvoraMark size={76} color={T.cobalt} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 200, letterSpacing: '0.28em', color: T.cobalt, textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '0.28em' }}>Payvora</div>
              <div style={{ fontSize: '8px', fontWeight: 500, letterSpacing: '0.38em', color: T.slate, textTransform: 'uppercase', paddingLeft: '0.38em' }}>Global Financial Technology</div>
            </div>
            <div style={{ width: '28px', height: '1px', background: T.gold, opacity: 0.7 }} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Closing ────────────────────────────────────────────────────────────────
function ClosingSection() {
  const [hovered, setHovered] = useState(false)

  return (
    <section
      style={{
        minHeight: '54vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(80px,12vw,140px) 24px',
        background: T.bg2,
        borderTop: `1px solid ${T.line}`,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 70% at 50% 105%, rgba(59,85,245,0.07) 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '44px' }}>
          <PayvoraMark size={60} />
        </div>

        <h2
          style={{
            fontSize: 'clamp(26px,4.5vw,56px)',
            fontWeight: 200,
            color: T.platinum,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            margin: '0 0 16px',
          }}
        >
          Built for institutions.<br />Designed for humans.
        </h2>
        <p style={{ fontSize: '13px', fontWeight: 300, color: T.slate, letterSpacing: '0.08em', margin: '0 0 48px' }}>
          Payvora — Global Financial Technology
        </p>

        <button
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered ? T.gold : 'transparent',
            border: `1px solid ${hovered ? T.gold : T.lineGold}`,
            color: hovered ? T.bg : T.gold,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            padding: '14px 36px',
            paddingLeft: 'calc(36px + 0.28em)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Request Access
        </button>
      </div>
    </section>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div
      style={{
        fontFamily: "'Outfit', sans-serif",
        background: T.bg,
        color: T.platinum,
        overflowX: 'hidden',
        minHeight: '100vh',
      }}
    >
      <style>{`
        @keyframes bloomFin {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1);   }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
      `}</style>
      <HeroSection />
      <AnatomySection />
      <EssenceSection />
      <ColorSection />
      <MarkVariantsSection />
      <TypographySection />
      <ApplicationsSection />
      <ClosingSection />
    </div>
  )
}
