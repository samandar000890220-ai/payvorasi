import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** Shared premium-fintech primitives for the Billing/Settings/Keys/Integrations pages. */

export const card: CSSProperties = {
  background: "var(--pv-card)",
  border: "1px solid var(--pv-border)",
  borderRadius: 18,
  padding: 24,
};

export const heading: CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--pv-text)",
  margin: 0,
};

export const subheading: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--pv-text)",
  margin: 0,
};

export const label: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--pv-text-secondary)",
  display: "block",
  marginBottom: 6,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--pv-border-strong)",
  background: "var(--pv-input-bg)",
  color: "var(--pv-text)",
  fontSize: 14,
  outline: "none",
  transition: "border-color 160ms ease",
  boxSizing: "border-box",
};

export const mutedText: CSSProperties = { fontSize: 13, color: "var(--pv-text-muted)", lineHeight: 1.5 };

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  title,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "10px 18px",
        borderRadius: 10,
        border: "none",
        background: disabled ? "var(--pv-border-strong)" : "var(--pv-brand)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        transition: "opacity 160ms ease, transform 160ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "8px 14px",
        borderRadius: 10,
        border: "1px solid var(--pv-border-strong)",
        background: "transparent",
        color: danger ? "#dc2626" : "var(--pv-text)",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background 160ms ease",
      }}
    >
      {children}
    </button>
  );
}

/** Transient inline success/error banner. */
export function Banner({ kind, message, onClose }: { kind: "success" | "error"; message: string; onClose?: () => void }) {
  useEffect(() => {
    if (kind === "success" && onClose) {
      const t = setTimeout(onClose, 3200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [kind, message, onClose]);
  const color = kind === "success" ? "#16a34a" : "#dc2626";
  const bg = kind === "success" ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${color}33`,
        background: bg,
        color,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: "none", color, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
          ×
        </button>
      )}
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", radius = 8 }: { height?: number; width?: number | string; radius?: number }) {
  return <div className="pv-skel" style={{ height, width, borderRadius: radius }} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: 40 }}>
      <p style={{ ...mutedText, color: "#dc2626", marginBottom: 16 }}>{message}</p>
      <PrimaryButton onClick={onRetry}>Retry</PrimaryButton>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: 48 }}>
      <p style={{ ...subheading, marginBottom: 8 }}>{title}</p>
      <p style={{ ...mutedText, maxWidth: 420, margin: "0 auto 20px" }}>{body}</p>
      {action}
    </div>
  );
}

/** Accessible toggle switch. */
export function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: "none",
        background: checked ? "var(--pv-brand)" : "var(--pv-border-strong)",
        position: "relative",
        cursor: "pointer",
        transition: "background 180ms ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 180ms ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

/** Small hook: transient banner state manager. */
export function useBanner() {
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  return {
    banner,
    ok: (message: string) => setBanner({ kind: "success", message }),
    fail: (message: string) => setBanner({ kind: "error", message }),
    clear: () => setBanner(null),
  };
}
