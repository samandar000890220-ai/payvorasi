import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../../lib/http";

// ── Shared design tokens & primitives for the Documents / Templates / Knowledge domain ──

export const card: CSSProperties = {
  border: "1px solid var(--pv-border)",
  borderRadius: 18,
  background: "var(--pv-card)",
  boxShadow: "var(--pv-shadow)",
};

export const inputStyle: CSSProperties = {
  background: "var(--pv-input-bg)",
  border: "1px solid var(--pv-border-strong)",
  borderRadius: 10,
  padding: "9px 12px",
  color: "var(--pv-text)",
  fontSize: 14,
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  transition: "border-color 160ms ease",
};

export function PrimaryButton({ children, onClick, disabled, title, style, type }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; style?: CSSProperties; type?: "button" | "submit";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: disabled ? "var(--pv-border-strong)" : "var(--pv-brand)",
        color: disabled ? "var(--pv-text-muted)" : "#fff",
        border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "-0.01em",
        transition: "opacity 160ms ease, transform 160ms ease", fontFamily: "inherit",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, title, active, style }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; active?: boolean; style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: active ? "var(--pv-hover)" : "transparent",
        color: active ? "var(--pv-brand)" : "var(--pv-text-secondary)",
        border: "1px solid var(--pv-border-strong)", borderRadius: 10, padding: "8px 13px",
        fontSize: 13, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "all 160ms ease", fontFamily: "inherit",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--pv-text)", margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 14, color: "var(--pv-text-secondary)", margin: "6px 0 0" }}>{subtitle}</p>
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function Skeleton({ height = 80, width = "100%", radius = 12 }: { height?: number | string; width?: number | string; radius?: number }) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: "linear-gradient(90deg, var(--pv-border) 25%, var(--pv-hover) 37%, var(--pv-border) 63%)",
      backgroundSize: "400% 100%", animation: "pv-shimmer 1.4s ease infinite",
    }} />
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, padding: 32, textAlign: "center" }}>
      <p style={{ color: "#dc2626", fontSize: 14, margin: "0 0 14px", fontWeight: 500 }}>{message}</p>
      <PrimaryButton onClick={onRetry}>Retry</PrimaryButton>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div style={{ ...card, padding: 48, textAlign: "center" }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--pv-text)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>{title}</p>
      <p style={{ fontSize: 14, color: "var(--pv-text-muted)", margin: "0 0 18px" }}>{hint}</p>
      {action}
    </div>
  );
}

/** Transient inline banner for success/error feedback. */
export function useToast() {
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = toast ? (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 50,
      background: toast.kind === "ok" ? "var(--pv-brand)" : "#dc2626", color: "#fff",
      padding: "11px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500,
      boxShadow: "var(--pv-shadow)", maxWidth: 420,
    }}>{toast.text}</div>
  ) : null;
  return { toast: node, ok: (t: string) => show("ok", t), err: (t: string) => show("err", t) };
}

/** Navigate to another Payvora page (App shell listens for popstate). */
export function navigateTo(path: string) {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  window.history.pushState({}, "", `${base}${path}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** SSE streaming AI action — calls onChunk with each content delta, resolves when done. */
export async function streamAi(
  path: string,
  body: unknown,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(api(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `AI request failed (${res.status}).`;
    try { const j = await res.json() as { message?: string }; if (j?.message) message = j.message; } catch { /* keep */ }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      try {
        const obj = JSON.parse(payload) as { content?: string; done?: boolean; error?: string };
        if (obj.error) throw new Error(obj.error);
        if (obj.content) onChunk(obj.content);
        if (obj.done) return;
      } catch (err) {
        if (err instanceof Error && err.message && !payload.includes("content")) throw err;
      }
    }
  }
}
