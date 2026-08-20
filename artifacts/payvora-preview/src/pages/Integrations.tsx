import { useCallback, useEffect, useState } from "react";
import { getJson, sendJson } from "../lib/http";
import { formatDate } from "../lib/format";
import { card, heading, subheading, mutedText, label as lbl, inputStyle, PrimaryButton, GhostButton, Banner, Skeleton, ErrorState, EmptyState, useBanner } from "./settings/ui";

type Provider = { slug: string; name: string; category: string; connected: boolean; configured: boolean; status: string; detail: string; model?: string; device?: string };
type CatalogItem = { slug: string; name: string; category: string; reason: string };
type Webhook = { id: string; name: string; url: string; events: string[]; status: string; createdAt: string; updatedAt: string };
type Log = { id: string; level: string; message: string; createdAt: string };

const STATUS_COLOR: Record<string, string> = { live: "#16a34a", connected: "#16a34a", unreachable: "#dc2626", not_configured: "#b45309", error: "#dc2626" };

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const banner = useBanner();

  // create/edit form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selEvents, setSelEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, w, e] = await Promise.all([
        getJson<{ providers: Provider[] }>("/integrations/status"),
        getJson<{ integrations: CatalogItem[] }>("/integrations/catalog"),
        getJson<{ webhooks: Webhook[] }>("/integrations/webhooks"),
        getJson<{ events: string[] }>("/integrations/webhook-events"),
      ]);
      setProviders(s.providers);
      setCatalog(c.integrations);
      setWebhooks(w.webhooks);
      setEvents(e.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleEvent = (e: string) => setSelEvents(prev => (prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]));

  const createWebhook = async () => {
    setSaving(true);
    banner.clear();
    try {
      const res = await sendJson<{ webhook: Webhook }>("/integrations/webhooks", "POST", { name, url, events: selEvents });
      setWebhooks(prev => [res.webhook, ...prev]);
      setName(""); setUrl(""); setSelEvents([]);
      banner.ok("Webhook created.");
    } catch (e) {
      banner.fail(e instanceof Error ? e.message : "Failed to create webhook.");
    } finally {
      setSaving(false);
    }
  };

  const deleteWebhook = async (wh: Webhook) => {
    if (!window.confirm(`Delete webhook "${wh.name}"?`)) return;
    banner.clear();
    try {
      await sendJson<void>(`/integrations/webhooks/${wh.id}`, "DELETE");
      setWebhooks(prev => prev.filter(w => w.id !== wh.id));
      if (logsFor === wh.id) { setLogsFor(null); setLogs([]); }
      banner.ok("Webhook deleted.");
    } catch (e) {
      banner.fail(e instanceof Error ? e.message : "Failed to delete webhook.");
    }
  };

  const testWebhook = async (wh: Webhook) => {
    setTesting(wh.id);
    banner.clear();
    try {
      const res = await sendJson<{ delivered: boolean; httpStatus: number | null; message: string }>(`/integrations/webhooks/${wh.id}/test`, "POST");
      if (res.delivered) banner.ok(res.message);
      else banner.fail(res.message);
      if (logsFor === wh.id) await viewLogs(wh);
    } catch (e) {
      banner.fail(e instanceof Error ? e.message : "Failed to send test event.");
    } finally {
      setTesting(null);
    }
  };

  const viewLogs = async (wh: Webhook) => {
    setLogsFor(wh.id);
    try {
      const res = await getJson<{ logs: Log[] }>(`/integrations/webhooks/${wh.id}/logs`);
      setLogs(res.logs);
    } catch (e) {
      banner.fail(e instanceof Error ? e.message : "Failed to load logs.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1040 }}>
        <Skeleton height={30} width={220} />
        <div style={card}><Skeleton height={20} width={180} /><div style={{ height: 12 }} /><Skeleton height={80} /></div>
      </div>
    );
  }
  if (error) return <div style={{ maxWidth: 1040 }}><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div className="integrations-page" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1040, paddingBottom: 48 }}>
      <div>
        <h1 style={heading}>Integrations</h1>
        <p style={{ ...mutedText, marginTop: 4 }}>Connected services, webhooks and delivery logs.</p>
      </div>

      {banner.banner && <Banner kind={banner.banner.kind} message={banner.banner.message} onClose={banner.clear} />}

      {/* Connected providers — real statuses */}
      <section>
        <h2 style={{ ...subheading, marginBottom: 16 }}>Connected services</h2>
        <div className="integrations-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {providers.map(p => (
            <div key={p.slug} style={{ ...card, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ ...subheading, fontSize: 15 }}>{p.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: STATUS_COLOR[p.status] ?? "var(--pv-text-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[p.status] ?? "var(--pv-text-muted)" }} />
                  {p.status.replace("_", " ")}
                </span>
              </div>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--pv-text-muted)", marginBottom: 8 }}>{p.category}</p>
              <p style={mutedText}>{p.detail}</p>
              {p.model && <p style={{ ...mutedText, marginTop: 8, fontSize: 12 }}>Model: {p.model} · Device: {p.device}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Webhook create */}
      <section style={card}>
        <h2 style={{ ...subheading, marginBottom: 16 }}>Add a webhook</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="integrations-wh-form">
          <div><label style={lbl}>Name</label><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Slack notifier" maxLength={80} /></div>
          <div><label style={lbl}>Endpoint URL</label><input style={inputStyle} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/hook" /></div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Events</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {events.map(ev => {
              const on = selEvents.includes(ev);
              return (
                <button key={ev} type="button" onClick={() => toggleEvent(ev)} style={{
                  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  border: `1px solid ${on ? "var(--pv-brand)" : "var(--pv-border-strong)"}`,
                  background: on ? "var(--pv-brand)" : "transparent", color: on ? "#fff" : "var(--pv-text-secondary)", transition: "all 150ms ease",
                }}>{ev}</button>
              );
            })}
          </div>
        </div>
        <PrimaryButton onClick={createWebhook} disabled={saving || !name.trim() || !url.trim() || selEvents.length === 0}
          title={!name.trim() ? "Enter a name" : !url.trim() ? "Enter a URL" : selEvents.length === 0 ? "Select at least one event" : undefined}>
          {saving ? "Saving…" : "Add webhook"}
        </PrimaryButton>
      </section>

      {/* Webhook list */}
      <section>
        <h2 style={{ ...subheading, marginBottom: 16 }}>Webhooks</h2>
        {webhooks.length === 0 ? (
          <EmptyState title="No webhooks yet" body="Add a webhook above, then use ‘Send test’ to deliver a JSON test event. Automatic event dispatch is not built yet — only manual test delivery works today." action={null} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {webhooks.map(wh => (
              <div key={wh.id} style={{ ...card, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--pv-text)" }}>{wh.name}</p>
                    <p style={{ ...mutedText, wordBreak: "break-all" }}>{wh.url}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {wh.events.map(ev => <span key={ev} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--pv-hover)", color: "var(--pv-text-secondary)" }}>{ev}</span>)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <GhostButton onClick={() => testWebhook(wh)} disabled={testing === wh.id}>{testing === wh.id ? "Sending…" : "Send test event"}</GhostButton>
                    <GhostButton onClick={() => viewLogs(wh)}>Logs</GhostButton>
                    <GhostButton onClick={() => deleteWebhook(wh)} danger>Delete</GhostButton>
                  </div>
                </div>
                {logsFor === wh.id && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--pv-border)", paddingTop: 14 }}>
                    <p style={{ ...mutedText, fontWeight: 600, marginBottom: 8 }}>Delivery log</p>
                    {logs.length === 0 ? (
                      <p style={mutedText}>No deliveries yet. Send a test event.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {logs.map(l => (
                          <div key={l.id} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                            <span style={{ color: l.level === "error" ? "#dc2626" : "#16a34a", fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>{l.level}</span>
                            <span style={{ color: "var(--pv-text-muted)", flexShrink: 0 }}>{formatDate(l.createdAt)}</span>
                            <span style={{ color: "var(--pv-text-secondary)" }}>{l.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Available catalog — honest not-connected cards */}
      <section>
        <h2 style={{ ...subheading, marginBottom: 4 }}>Available integrations</h2>
        <p style={{ ...mutedText, marginBottom: 16 }}>These require OAuth infrastructure that is not connected yet.</p>
        <div className="integrations-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
          {catalog.map(c => (
            <div key={c.slug} style={{ ...card, padding: 20, opacity: 0.85 }}>
              <p style={{ ...subheading, fontSize: 15 }}>{c.name}</p>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--pv-text-muted)", margin: "6px 0 10px" }}>{c.category}</p>
              <p style={{ ...mutedText, marginBottom: 14 }}>Not connected — connection flow coming soon.</p>
              <GhostButton disabled title={c.reason}>Connect</GhostButton>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
