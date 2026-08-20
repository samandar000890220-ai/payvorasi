import React, { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const vars = {
  page: "var(--pv-page)",
  card: "var(--pv-card)",
  border: "var(--pv-border)",
  borderStrong: "var(--pv-border-strong)",
  text: "var(--pv-text)",
  textSec: "var(--pv-text-secondary)",
  muted: "var(--pv-text-muted)",
  brand: "var(--pv-brand)",
  hover: "var(--pv-hover)",
  shadow: "var(--pv-shadow)",
  inputBg: "var(--pv-input-bg)",
};

export function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ color: vars.text, maxWidth: 1200 }}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: vars.textSec, margin: "6px 0 0" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const cardStyle: CSSProperties = {
  border: `1px solid ${vars.border}`,
  borderRadius: 18,
  background: vars.card,
  padding: 20,
};

export function Button({ children, onClick, disabled, variant = "primary", title, type }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger" | "ghost"; title?: string; type?: "button" | "submit";
}) {
  const base: CSSProperties = {
    padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 160ms, background 160ms", opacity: disabled ? 0.5 : 1, border: "1px solid transparent", fontFamily: "inherit",
  };
  const styles: Record<string, CSSProperties> = {
    primary: { background: vars.brand, color: "#fff" },
    secondary: { background: vars.card, color: vars.text, border: `1px solid ${vars.borderStrong}` },
    danger: { background: "transparent", color: "#dc2626", border: "1px solid rgba(220,38,38,0.4)" },
    ghost: { background: "transparent", color: vars.textSec },
  };
  return <button type={type ?? "button"} title={title} onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}>{children}</button>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{
    padding: "9px 12px", borderRadius: 10, border: `1px solid ${vars.border}`, background: vars.inputBg, color: vars.text,
    fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", ...props.style,
  }} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{
    padding: "10px 12px", borderRadius: 10, border: `1px solid ${vars.border}`, background: vars.inputBg, color: vars.text,
    fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", resize: "vertical", ...props.style,
  }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{
    padding: "9px 12px", borderRadius: 10, border: `1px solid ${vars.border}`, background: vars.inputBg, color: vars.text,
    fontSize: 14, fontFamily: "inherit", outline: "none", ...props.style,
  }} />;
}

export function Label({ children }: { children: ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: vars.textSec, display: "block", marginBottom: 6 }}>{children}</label>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue" | "red" }) {
  const tones: Record<string, CSSProperties> = {
    neutral: { background: vars.hover, color: vars.textSec },
    green: { background: "rgba(16,185,129,0.14)", color: "#059669" },
    amber: { background: "rgba(245,158,11,0.16)", color: "#b45309" },
    blue: { background: "rgba(59,130,246,0.14)", color: "#2563eb" },
    red: { background: "rgba(220,38,38,0.12)", color: "#dc2626" },
  };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, textTransform: "capitalize", ...tones[tone] }}>{children}</span>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ ...cardStyle, borderColor: "rgba(220,38,38,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#dc2626", fontSize: 14 }}>{message}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div style={{ ...cardStyle, textAlign: "center", padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <p style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 14, color: vars.muted, margin: 0, maxWidth: 420 }}>{description}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ height = 80, count = 3 }: { height?: number; count?: number }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height, borderRadius: 16, background: vars.hover, opacity: 0.6 }} />
      ))}
    </div>
  );
}

export function useSuccess(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 60, padding: "10px 16px", borderRadius: 12,
      background: "rgba(16,185,129,0.95)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: vars.shadow,
    }}>{message}</div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", background: vars.card, borderRadius: 20,
        border: `1px solid ${vars.border}`, boxShadow: vars.shadow, padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: vars.muted, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
