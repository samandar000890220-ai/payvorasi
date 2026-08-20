import { Router, type IRouter } from "express";
import { db, projectsTable, projectActivityTable, documentsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { sessionOwner } from "../lib/session";

const router: IRouter = Router();

const STATUSES = ["active", "paused", "completed", "archived"] as const;
type ProjectRow = typeof projectsTable.$inferSelect;

const projectJson = (p: ProjectRow) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  status: p.status,
  progress: p.progress,
  members: p.members,
  linkedDocumentIds: p.linkedDocumentIds,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

async function activity(ownerId: string, projectId: string, message: string) {
  try {
    await db.insert(projectActivityTable).values({ ownerId, projectId, message });
  } catch {
    /* activity logging must not break the feature */
  }
}

// ── Projects CRUD ──────────────────────────────────────────────────────────────
router.get("/projects", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, ownerId)).orderBy(desc(projectsTable.updatedAt));
  res.json({ projects: rows.map(projectJson) });
});

router.post("/projects", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { name?: unknown; description?: unknown };
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 120) return void res.status(422).json({ message: "Project name is required and must be 120 characters or fewer." });
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
  const [row] = await db.insert(projectsTable).values({ ownerId, name, description }).returning();
  await activity(ownerId, row.id, `Project "${name}" created.`);
  res.status(201).json(projectJson(row));
});

router.get("/projects/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId)));
  if (!row) return void res.status(404).json({ message: "Project not found." });
  res.json(projectJson(row));
});

router.patch("/projects/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId)));
  if (!existing) return void res.status(404).json({ message: "Project not found." });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const notes: string[] = [];
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 120) return void res.status(422).json({ message: "Project name must be 1–120 characters." });
    if (name !== existing.name) notes.push(`renamed to "${name}"`);
    patch.name = name;
  }
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 1000);
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) return void res.status(422).json({ message: "Invalid status." });
    if (body.status !== existing.status) notes.push(`status set to ${body.status}`);
    patch.status = body.status;
  }
  if (typeof body.progress === "number" && Number.isFinite(body.progress)) {
    const progress = Math.max(0, Math.min(100, Math.round(body.progress)));
    if (progress !== existing.progress) notes.push(`progress set to ${progress}%`);
    patch.progress = progress;
  }
  if (Object.keys(patch).length === 0) return void res.status(422).json({ message: "Nothing to update." });
  const [row] = await db.update(projectsTable).set(patch).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId))).returning();
  if (notes.length) await activity(ownerId, row.id, `Project ${notes.join(", ")}.`);
  res.json(projectJson(row));
});

router.delete("/projects/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.delete(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Project not found." });
  await db.delete(projectActivityTable).where(and(eq(projectActivityTable.projectId, req.params.id), eq(projectActivityTable.ownerId, ownerId)));
  res.status(204).end();
});

// ── Members (contact entries) ────────────────────────────────────────────────
router.post("/projects/:id/members", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId)));
  if (!existing) return void res.status(404).json({ message: "Project not found." });
  const body = req.body as { name?: unknown; email?: unknown; role?: unknown };
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 120) return void res.status(422).json({ message: "Contact name is required." });
  const member: { name: string; email?: string; role?: string } = { name };
  if (typeof body.email === "string" && body.email.trim()) member.email = body.email.trim().slice(0, 200);
  if (typeof body.role === "string" && body.role.trim()) member.role = body.role.trim().slice(0, 80);
  const members = [...existing.members, member];
  const [row] = await db.update(projectsTable).set({ members }).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId))).returning();
  await activity(ownerId, row.id, `Contact "${name}" added.`);
  res.status(201).json(projectJson(row));
});

router.delete("/projects/:id/members/:index", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId)));
  if (!existing) return void res.status(404).json({ message: "Project not found." });
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= existing.members.length) return void res.status(404).json({ message: "Contact not found." });
  const removed = existing.members[index];
  const members = existing.members.filter((_, i) => i !== index);
  const [row] = await db.update(projectsTable).set({ members }).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId))).returning();
  await activity(ownerId, row.id, `Contact "${removed?.name ?? ""}" removed.`);
  res.json(projectJson(row));
});

// ── Linked documents ──────────────────────────────────────────────────────────
router.put("/projects/:id/documents", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId)));
  if (!existing) return void res.status(404).json({ message: "Project not found." });
  const ids = Array.isArray((req.body as { documentIds?: unknown }).documentIds)
    ? ((req.body as { documentIds: unknown[] }).documentIds.filter(x => typeof x === "string") as string[])
    : [];
  // Only keep ids that genuinely belong to this owner's documents.
  let valid: string[] = [];
  if (ids.length) {
    const docs = await db.select({ id: documentsTable.id }).from(documentsTable).where(and(eq(documentsTable.ownerId, ownerId), inArray(documentsTable.id, ids)));
    const owned = new Set(docs.map(d => d.id));
    valid = ids.filter(id => owned.has(id));
  }
  const [row] = await db.update(projectsTable).set({ linkedDocumentIds: valid }).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId))).returning();
  await activity(ownerId, row.id, `Linked documents updated (${valid.length} linked).`);
  res.json(projectJson(row));
});

// ── Activity timeline ──────────────────────────────────────────────────────────
router.get("/projects/:id/activity", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.ownerId, ownerId)));
  if (!existing) return void res.status(404).json({ message: "Project not found." });
  const rows = await db.select().from(projectActivityTable).where(and(eq(projectActivityTable.projectId, req.params.id), eq(projectActivityTable.ownerId, ownerId))).orderBy(desc(projectActivityTable.createdAt)).limit(200);
  res.json({ activity: rows.map(a => ({ id: a.id, message: a.message, createdAt: a.createdAt.toISOString() })) });
});

export default router;
