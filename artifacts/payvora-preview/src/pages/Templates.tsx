import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson, sendJson } from "../lib/http";
import { sanitizeHtml } from "../lib/sanitize";
import { card, inputStyle, PageHeader, PrimaryButton, GhostButton, Skeleton, ErrorState, EmptyState, useToast, navigateTo } from "./documents/shared";

type Template = {
  id: string; name: string; category: string; description: string; content: string;
  useCount: number; favorite: boolean; builtin: boolean; createdAt: string;
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "finance", label: "Finance" },
  { key: "document", label: "Document" },
  { key: "workflow", label: "Workflow" },
];

const CAT_COLOR: Record<string, string> = {
  business: "#7c3aed", finance: "#16a34a", document: "#2563eb", workflow: "#ea580c",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (category !== "all") q.set("category", category);
      if (search.trim()) q.set("search", search.trim());
      const data = await getJson<{ templates: Template[] }>(`/templates?${q.toString()}`);
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => { const t = setTimeout(load, search ? 250 : 0); return () => clearTimeout(t); }, [load, search]);

  const toggleFavorite = async (t: Template) => {
    try {
      await sendJson(`/templates/${t.id}/favorite`, "POST", { favorite: !t.favorite });
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, favorite: !x.favorite } : x));
      if (preview?.id === t.id) setPreview({ ...preview, favorite: !preview.favorite });
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "Could not update favorite.");
    }
  };

  const useTemplate = async (t: Template) => {
    setBusy(t.id);
    try {
      await sendJson<{ documentId: string }>(`/templates/${t.id}/use`, "POST");
      toast.ok(`Created a document from “${t.name}”.`);
      setPreview(null);
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "Could not use template.");
    } finally {
      setBusy(null);
    }
  };

  const deleteTemplate = async (t: Template) => {
    if (!window.confirm(`Delete your template “${t.name}”?`)) return;
    try {
      await sendJson(`/templates/${t.id}`, "DELETE");
      setTemplates(prev => prev.filter(x => x.id !== t.id));
      if (preview?.id === t.id) setPreview(null);
      toast.ok("Template deleted.");
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "Could not delete template.");
    }
  };

  const grouped = useMemo(() => templates, [templates]);

  return (
    <div className="pv-page">
      {toast.toast}
      <PageHeader
        title="Templates"
        subtitle="Start faster with ready-made business, finance and workflow templates."
        actions={<PrimaryButton onClick={() => setCreateOpen(true)}>+ New template</PrimaryButton>}
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map(c => (
            <GhostButton key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</GhostButton>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {loading ? (
        <div className="tmpl-grid">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={150} />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No templates match"
          hint={search ? "Try a different search or category." : "Create your first custom template to reuse it anytime."}
          action={<PrimaryButton onClick={() => setCreateOpen(true)}>Create a template</PrimaryButton>}
        />
      ) : (
        <div className="tmpl-grid">
          {grouped.map(t => (
            <div key={t.id} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                  color: CAT_COLOR[t.category] ?? "var(--pv-text-muted)",
                }}>{t.category}</span>
                <button onClick={() => toggleFavorite(t)} title={t.favorite ? "Unfavorite" : "Favorite"}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: t.favorite ? "var(--pv-brand)" : "var(--pv-text-muted)", padding: 0 }}>
                  {t.favorite ? "★" : "☆"}
                </button>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--pv-text)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>{t.name}</h3>
                <p style={{ fontSize: 13, color: "var(--pv-text-secondary)", margin: 0, lineHeight: 1.4 }}>{t.description}</p>
              </div>
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--pv-text-muted)" }}>{t.useCount} use{t.useCount === 1 ? "" : "s"}{t.builtin ? "" : " · Custom"}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <GhostButton onClick={() => setPreview(t)}>Preview</GhostButton>
                  <PrimaryButton onClick={() => useTemplate(t)} disabled={busy === t.id} style={{ padding: "8px 13px", fontSize: 13 }}>
                    {busy === t.id ? "Creating…" : "Use"}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal onClose={() => setPreview(null)} title={preview.name}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <PrimaryButton onClick={() => useTemplate(preview)} disabled={busy === preview.id}>
              {busy === preview.id ? "Creating…" : "Use template"}
            </PrimaryButton>
            <GhostButton onClick={() => toggleFavorite(preview)}>{preview.favorite ? "★ Favorited" : "☆ Favorite"}</GhostButton>
            {!preview.builtin && <GhostButton onClick={() => deleteTemplate(preview)} style={{ color: "#dc2626" }}>Delete</GhostButton>}
          </div>
          <div
            style={{ ...card, padding: 20, maxHeight: "55vh", overflow: "auto", fontSize: 14, lineHeight: 1.6, color: "var(--pv-text)" }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.content) }}
          />
        </Modal>
      )}

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); toast.ok("Template created."); }} onError={m => toast.err(m)} />}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 24, width: "min(720px, 100%)", maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--pv-text)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--pv-text-muted)", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [categoryVal, setCategoryVal] = useState("business");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !content.trim()) { onError("Name and content are required."); return; }
    setSaving(true);
    try {
      await sendJson("/templates", "POST", { name: name.trim(), category: categoryVal, description: description.trim(), content });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Create a template">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Template name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <select value={categoryVal} onChange={e => setCategoryVal(e.target.value)} style={inputStyle}>
          <option value="business">Business</option>
          <option value="finance">Finance</option>
          <option value="document">Document</option>
          <option value="workflow">Workflow</option>
        </select>
        <input placeholder="Short description" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
        <textarea placeholder="Template content (HTML supported, e.g. <h1>Title</h1><p>…</p>)" value={content} onChange={e => setContent(e.target.value)}
          style={{ ...inputStyle, minHeight: 220, resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={saving || !name.trim() || !content.trim()} title={!name.trim() || !content.trim() ? "Name and content required" : undefined}>
            {saving ? "Saving…" : "Create template"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
