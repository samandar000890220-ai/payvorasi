import { useCallback, useEffect, useState } from "react";
import { getJson, sendJson } from "../lib/http";
import {
  PageShell, PageHeader, Button, Input, Textarea, Select, Label, Badge,
  ErrorState, EmptyState, Skeleton, cardStyle, vars, useSuccess, SuccessBanner, Modal,
} from "./_shared/ui";

type Member = { name: string; email?: string; role?: string };
type Project = {
  id: string; name: string; description: string; status: string; progress: number;
  members: Member[]; linkedDocumentIds: string[]; createdAt: string; updatedAt: string;
};
type DocMeta = { id: string; title: string };
type ActivityEntry = { id: string; message: string; createdAt: string };

const STATUSES = ["active", "paused", "completed", "archived"];
const statusTone = (s: string) => (s === "active" ? "green" : s === "paused" ? "amber" : s === "completed" ? "blue" : "neutral") as "green" | "amber" | "blue" | "neutral";

export default function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [success, setSuccess] = useSuccess();

  const load = useCallback(async () => {
    setError(null);
    try { setProjects((await getJson<{ projects: Project[] }>("/projects")).projects); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load projects."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = (projects ?? []).filter(p => filter === "all" || p.status === filter);

  return (
    <PageShell>
      <SuccessBanner message={success} />
      <PageHeader
        title="Projects"
        subtitle="Organize work with progress tracking, contacts, and linked documents."
        action={<Button onClick={() => setShowCreate(true)}>+ New project</Button>}
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : projects === null ? (
        <Skeleton height={140} count={3} />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create a project to track progress, add contacts, and link documents." action={<Button onClick={() => setShowCreate(true)}>+ New project</Button>} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {["all", ...STATUSES].map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                border: `1px solid ${filter === s ? vars.brand : vars.border}`, background: filter === s ? vars.hover : vars.card,
                color: filter === s ? vars.brand : vars.textSec,
              }}>{s}</button>
            ))}
          </div>
          {visible.length === 0 ? (
            <EmptyState title="No projects in this filter" description="Switch filters or create a new project." action={<Button onClick={() => setShowCreate(true)}>+ New project</Button>} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {visible.map(p => (
                <button key={p.id} onClick={() => setOpenId(p.id)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</h3>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </div>
                  <p style={{ fontSize: 13, color: vars.textSec, margin: "8px 0 14px", minHeight: 20, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description || "No description."}</p>
                  <ProgressBar value={p.progress} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: vars.muted, marginTop: 12 }}>
                    <span>{p.members.length} contact{p.members.length === 1 ? "" : "s"}</span>
                    <span>{p.linkedDocumentIds.length} doc{p.linkedDocumentIds.length === 1 ? "" : "s"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && <CreateProject onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); setSuccess("Project created."); }} />}
      {openId && <ProjectDetail id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} notify={setSuccess} />}
    </PageShell>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: vars.muted, marginBottom: 4 }}>
        <span>Progress</span><span>{value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: vars.hover, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: vars.brand, transition: "width 200ms" }} />
      </div>
    </div>
  );
}

function CreateProject({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try { await sendJson("/projects", "POST", { name: name.trim(), description: description.trim() }); onCreated(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create project."); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="New project" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Marketing Launch" autoFocus /></div>
        <div><Label>Description</Label><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this project about?" /></div>
        {error && <ErrorState message={error} />}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!name.trim() || saving}>{saving ? "Creating…" : "Create"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectDetail({ id, onClose, onChanged, notify }: { id: string; onClose: () => void; onChanged: () => void; notify: (m: string) => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  // document linking
  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [linkedDraft, setLinkedDraft] = useState<string[]>([]);

  // member add
  const [mName, setMName] = useState(""); const [mEmail, setMEmail] = useState(""); const [mRole, setMRole] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await getJson<Project>(`/projects/${id}`);
      setProject(p); setLinkedDraft(p.linkedDocumentIds);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load project."); }
  }, [id]);

  const loadActivity = useCallback(async () => {
    try { setActivity((await getJson<{ activity: ActivityEntry[] }>(`/projects/${id}/activity`)).activity); }
    catch { /* activity is secondary */ }
  }, [id]);

  useEffect(() => { void load(); void loadActivity(); }, [load, loadActivity]);
  useEffect(() => {
    getJson<{ documents: DocMeta[] }>("/documents")
      .then(d => setDocs(d.documents))
      .catch(e => setDocsError(e instanceof Error ? e.message : "Documents unavailable."));
  }, []);

  const patch = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true); setError(null);
    try { setProject(await sendJson<Project>(`/projects/${id}`, "PATCH", body)); onChanged(); void loadActivity(); notify(msg); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(false); }
  };

  const addMember = async () => {
    if (!mName.trim()) return;
    setBusy(true); setError(null);
    try {
      const p = await sendJson<Project>(`/projects/${id}/members`, "POST", { name: mName.trim(), email: mEmail.trim() || undefined, role: mRole.trim() || undefined });
      setProject(p); setMName(""); setMEmail(""); setMRole(""); onChanged(); void loadActivity(); notify("Contact added.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add contact."); }
    finally { setBusy(false); }
  };

  const removeMember = async (index: number) => {
    setBusy(true); setError(null);
    try { const p = await sendJson<Project>(`/projects/${id}/members/${index}`, "DELETE"); setProject(p); onChanged(); void loadActivity(); notify("Contact removed."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not remove contact."); }
    finally { setBusy(false); }
  };

  const saveLinks = async () => {
    setBusy(true); setError(null);
    try { const p = await sendJson<Project>(`/projects/${id}/documents`, "PUT", { documentIds: linkedDraft }); setProject(p); setLinkedDraft(p.linkedDocumentIds); onChanged(); void loadActivity(); notify("Linked documents updated."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update links."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete project "${project?.name}"?`)) return;
    setBusy(true); setError(null);
    try { await sendJson(`/projects/${id}`, "DELETE"); onChanged(); notify("Project deleted."); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); setBusy(false); }
  };

  if (!project) return <Modal title="Project" onClose={onClose}>{error ? <ErrorState message={error} onRetry={() => void load()} /> : <Skeleton height={40} count={3} />}</Modal>;

  const linksDirty = JSON.stringify([...linkedDraft].sort()) !== JSON.stringify([...project.linkedDocumentIds].sort());

  return (
    <Modal title={project.name} onClose={onClose}>
      <div style={{ display: "grid", gap: 20 }}>
        {error && <ErrorState message={error} />}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 160 }}>
            <Label>Status</Label>
            <Select value={project.status} onChange={e => void patch({ status: e.target.value }, `Status set to ${e.target.value}.`)} disabled={busy} style={{ width: "100%" }}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <Label>Progress: {project.progress}%</Label>
          <input type="range" min={0} max={100} value={project.progress}
            onChange={e => setProject(p => (p ? { ...p, progress: Number(e.target.value) } : p))}
            onMouseUp={e => void patch({ progress: Number((e.target as HTMLInputElement).value) }, "Progress updated.")}
            onTouchEnd={e => void patch({ progress: Number((e.target as HTMLInputElement).value) }, "Progress updated.")}
            style={{ width: "100%", accentColor: vars.brand }} />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea rows={3} defaultValue={project.description}
            onBlur={e => { if (e.target.value.trim() !== project.description) void patch({ description: e.target.value.trim() }, "Description updated."); }} />
          <p style={{ fontSize: 11, color: vars.muted, marginTop: 4 }}>Saved when you click away.</p>
        </div>

        {/* Contacts */}
        <div>
          <Label>Contacts</Label>
          <p style={{ fontSize: 11, color: vars.muted, marginTop: -2, marginBottom: 8 }}>Contact entries only — not login users (Payvora has no auth system yet).</p>
          <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            {project.members.length === 0 ? <p style={{ fontSize: 13, color: vars.muted }}>No contacts yet.</p> : project.members.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${vars.border}`, borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                  {m.role && <span style={{ fontSize: 12, color: vars.muted }}> · {m.role}</span>}
                  {m.email && <div style={{ fontSize: 12, color: vars.muted }}>{m.email}</div>}
                </div>
                <button onClick={() => void removeMember(i)} disabled={busy} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626", fontSize: 12 }}>Remove</button>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <Input placeholder="Name" value={mName} onChange={e => setMName(e.target.value)} />
            <Input placeholder="Email (optional)" value={mEmail} onChange={e => setMEmail(e.target.value)} />
            <Input placeholder="Role" value={mRole} onChange={e => setMRole(e.target.value)} style={{ width: 100 }} />
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => void addMember()} disabled={!mName.trim() || busy}>Add contact</Button>
          </div>
        </div>

        {/* Linked documents */}
        <div>
          <Label>Linked documents</Label>
          {docsError ? <p style={{ fontSize: 12, color: "#dc2626" }}>{docsError}</p>
            : docs === null ? <p style={{ fontSize: 12, color: vars.muted }}>Loading documents…</p>
            : docs.length === 0 ? <p style={{ fontSize: 12, color: vars.muted }}>No documents yet. Use a template to create one, then link it here.</p>
            : (
              <>
                <div style={{ display: "grid", gap: 6, maxHeight: 160, overflowY: "auto", border: `1px solid ${vars.border}`, borderRadius: 10, padding: 10 }}>
                  {docs.map(d => (
                    <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input type="checkbox" checked={linkedDraft.includes(d.id)}
                        onChange={() => setLinkedDraft(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])} />
                      {d.title}
                    </label>
                  ))}
                </div>
                {linksDirty && <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Button variant="secondary" onClick={() => setLinkedDraft(project.linkedDocumentIds)} disabled={busy}>Reset</Button>
                  <Button onClick={() => void saveLinks()} disabled={busy}>Save links</Button>
                </div>}
              </>
            )}
        </div>

        {/* Activity */}
        <div>
          <Label>Activity timeline</Label>
          {activity === null ? <p style={{ fontSize: 12, color: vars.muted }}>Loading…</p>
            : activity.length === 0 ? <p style={{ fontSize: 13, color: vars.muted }}>No activity yet.</p>
            : (
              <div style={{ display: "grid", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                {activity.map(a => (
                  <div key={a.id} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                    <span style={{ color: vars.muted, flexShrink: 0, width: 130 }}>{new Date(a.createdAt).toLocaleString()}</span>
                    <span style={{ color: vars.text }}>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div style={{ borderTop: `1px solid ${vars.border}`, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>Delete project</Button>
        </div>
      </div>
    </Modal>
  );
}
