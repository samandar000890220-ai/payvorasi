import { Router, type IRouter } from "express";
import { db, documentsTable, documentFoldersTable, documentVersionsTable, type Document, type DocumentFolder, type DocumentVersion } from "@workspace/db";
import { sessionOwner, errorMessage } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { createCanonicalChatCompletion } from "../ai/request";
import { and, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const wordCount = (html: string): number => {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
};

const docJson = (d: Document) => ({
  id: d.id, folderId: d.folderId, title: d.title, content: d.content,
  favorite: d.favorite, wordCount: d.wordCount,
  createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
});
const folderJson = (f: DocumentFolder) => ({ id: f.id, name: f.name, createdAt: f.createdAt.toISOString() });
const versionJson = (v: DocumentVersion) => ({ id: v.id, label: v.label, content: v.content, createdAt: v.createdAt.toISOString() });

const AI_MODEL = "gpt-5.6-terra";

// ── Folders ─────────────────────────────────────────────────────────────────
router.get("/documents/folders", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(documentFoldersTable).where(eq(documentFoldersTable.ownerId, ownerId)).orderBy(documentFoldersTable.name);
  res.json({ folders: rows.map(folderJson) });
});

router.post("/documents/folders", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const name = String((req.body as { name?: unknown })?.name ?? "").trim();
  if (!name || name.length > 80) return void res.status(422).json({ message: "Folder name must be 1–80 characters." });
  const [row] = await db.insert(documentFoldersTable).values({ ownerId, name }).returning();
  res.status(201).json(folderJson(row));
});

router.patch("/documents/folders/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const name = String((req.body as { name?: unknown })?.name ?? "").trim();
  if (!name || name.length > 80) return void res.status(422).json({ message: "Folder name must be 1–80 characters." });
  const [row] = await db.update(documentFoldersTable).set({ name })
    .where(and(eq(documentFoldersTable.id, req.params.id), eq(documentFoldersTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Folder not found." });
  res.json(folderJson(row));
});

router.delete("/documents/folders/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.delete(documentFoldersTable)
    .where(and(eq(documentFoldersTable.id, req.params.id), eq(documentFoldersTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Folder not found." });
  // Orphan documents (move to no folder) rather than delete them.
  await db.update(documentsTable).set({ folderId: null }).where(and(eq(documentsTable.folderId, req.params.id), eq(documentsTable.ownerId, ownerId)));
  res.status(204).end();
});

// ── Documents ─────────────────────────────────────────────────────────────────
router.get("/documents", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(documentsTable).where(eq(documentsTable.ownerId, ownerId)).orderBy(desc(documentsTable.updatedAt));
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const folderId = req.query.folderId ? String(req.query.folderId) : undefined;
  let filtered = rows;
  if (search) filtered = filtered.filter(d => d.title.toLowerCase().includes(search) || d.content.replace(/<[^>]+>/g, " ").toLowerCase().includes(search));
  if (folderId) filtered = filtered.filter(d => d.folderId === folderId);
  res.json({
    documents: filtered.map(docJson),
    recent: rows.slice(0, 5).map(docJson),
    favorites: rows.filter(d => d.favorite).map(docJson),
  });
});

router.get("/documents/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId)));
  if (!row) return void res.status(404).json({ message: "Document not found." });
  res.json(docJson(row));
});

router.post("/documents", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { title?: unknown; content?: unknown; folderId?: unknown };
  const title = (typeof body.title === "string" && body.title.trim()) ? body.title.trim().slice(0, 200) : "Untitled document";
  const content = typeof body.content === "string" ? body.content : "";
  const folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null;
  const [row] = await db.insert(documentsTable).values({ ownerId, title, content, folderId, wordCount: wordCount(content) }).returning();
  await recordUsage(ownerId, "documents", 1);
  res.status(201).json(docJson(row));
});

router.patch("/documents/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { title?: unknown; content?: unknown; favorite?: unknown; folderId?: unknown };
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t || t.length > 200) return void res.status(422).json({ message: "Title must be 1–200 characters." });
    patch.title = t;
  }
  if (typeof body.content === "string") { patch.content = body.content; patch.wordCount = wordCount(body.content); }
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;
  if ("folderId" in body) patch.folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null;
  if (Object.keys(patch).length === 0) return void res.status(422).json({ message: "Nothing to update." });
  const [row] = await db.update(documentsTable).set(patch)
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Document not found." });
  res.json(docJson(row));
});

router.delete("/documents/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.delete(documentsTable)
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Document not found." });
  await db.delete(documentVersionsTable).where(and(eq(documentVersionsTable.documentId, req.params.id), eq(documentVersionsTable.ownerId, ownerId)));
  res.status(204).end();
});

// ── Versions ────────────────────────────────────────────────────────────────
router.get("/documents/:id/versions", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [doc] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId)));
  if (!doc) return void res.status(404).json({ message: "Document not found." });
  const rows = await db.select().from(documentVersionsTable)
    .where(and(eq(documentVersionsTable.documentId, req.params.id), eq(documentVersionsTable.ownerId, ownerId)))
    .orderBy(desc(documentVersionsTable.createdAt));
  res.json({ versions: rows.map(versionJson) });
});

router.post("/documents/:id/versions", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [doc] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId)));
  if (!doc) return void res.status(404).json({ message: "Document not found." });
  const body = req.body as { content?: unknown; label?: unknown };
  const content = typeof body.content === "string" ? body.content : doc.content;
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : null;
  // Persist latest content on the document too so a save is a real save.
  await db.update(documentsTable).set({ content, wordCount: wordCount(content) })
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId)));
  const [row] = await db.insert(documentVersionsTable).values({ documentId: req.params.id, ownerId, content, label }).returning();
  res.status(201).json(versionJson(row));
});

router.post("/documents/:id/versions/:versionId/restore", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [version] = await db.select().from(documentVersionsTable)
    .where(and(eq(documentVersionsTable.id, req.params.versionId), eq(documentVersionsTable.documentId, req.params.id), eq(documentVersionsTable.ownerId, ownerId)));
  if (!version) return void res.status(404).json({ message: "Version not found." });
  const [row] = await db.update(documentsTable).set({ content: version.content, wordCount: wordCount(version.content) })
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Document not found." });
  res.json(docJson(row));
});

// ── Export (real content, downloadable) ───────────────────────────────────────
const htmlToMarkdown = (html: string): string => {
  let md = html;
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `# ${strip(t)}\n\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `## ${strip(t)}\n\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `### ${strip(t)}\n\n`);
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_, __, t) => `**${strip(t)}**`);
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_, __, t) => `*${strip(t)}*`);
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${strip(t)}\n`);
  md = md.replace(/<\/(ul|ol)>/gi, "\n");
  md = md.replace(/<(ul|ol)[^>]*>/gi, "");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");
  md = md.replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "\n");
  md = md.replace(/<[^>]+>/g, "");
  return decode(md).replace(/\n{3,}/g, "\n\n").trim() + "\n";
};
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, "")).trim();
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const safeFile = (title: string) => title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";

router.get("/documents/:id/export", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [doc] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.ownerId, ownerId)));
  if (!doc) return void res.status(404).json({ message: "Document not found." });
  const format = String(req.query.format ?? "md").toLowerCase();
  const name = safeFile(doc.title);
  if (format === "html") {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${strip(doc.title)}</title>` +
      `<style>body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;line-height:1.6;color:#111}h1,h2,h3{letter-spacing:-0.01em}</style>` +
      `</head><body><h1>${strip(doc.title)}</h1>${doc.content}</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.html"`);
    return void res.send(html);
  }
  const md = `# ${strip(doc.title)}\n\n${htmlToMarkdown(doc.content)}`;
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.md"`);
  res.send(md);
});

// ── AI assistant (streaming SSE) ──────────────────────────────────────────────
const AI_ACTIONS: Record<string, (input: string, extra: string) => { system: string; user: string }> = {
  generate: (_i, prompt) => ({
    system: "You are an expert business writer. Produce a complete, well-structured document in clean semantic HTML using <h1>,<h2>,<p>,<ul>,<li>,<strong>. Do not include <html> or <body> wrappers. No markdown fences.",
    user: `Write a document for this request:\n\n${prompt}`,
  }),
  summarize: (content) => ({
    system: "You are an expert editor. Summarize the document into concise HTML with a short <p> overview and a <ul> of key points. No wrappers, no markdown fences.",
    user: `Summarize this document:\n\n${content}`,
  }),
  rewrite: (selection, instruction) => ({
    system: "You are an expert copy editor. Rewrite the provided text to be clearer and more polished. Return HTML fragments only (<p>,<strong>,<em>). No wrappers, no markdown fences.",
    user: `Rewrite/improve this text${instruction ? ` with this instruction: ${instruction}` : ""}:\n\n${selection}`,
  }),
  extract: (content) => ({
    system: "You extract key information. Return HTML with an <h2>Key Information</h2> heading and a <ul> of the most important facts, figures, dates, names and action items found. No wrappers, no markdown fences.",
    user: `Extract key information from this document:\n\n${content}`,
  }),
  continue: (content) => ({
    system: "You are a writing assistant. Continue writing the document naturally from where it ends. Return only the new HTML fragment (<p>,<ul>,<li>) to append. No wrappers, no markdown fences.",
    user: `Continue this document:\n\n${content}`,
  }),
};

router.post("/documents/ai", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { action?: unknown; content?: unknown; selection?: unknown; instruction?: unknown; prompt?: unknown };
  const action = String(body.action ?? "");
  const builder = AI_ACTIONS[action];
  if (!builder) return void res.status(422).json({ message: `Unknown AI action "${action}".` });
  const input = String((action === "rewrite" ? body.selection : action === "generate" ? body.prompt : body.content) ?? "").trim();
  if (!input) return void res.status(422).json({ message: "Provide document content or a prompt for the AI action." });
  const extra = action === "generate" ? input : String(body.instruction ?? "").trim();
  const { system, user } = builder(input.slice(0, 24000), extra.slice(0, 4000));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  let chars = 0;
  try {
    const stream = await createCanonicalChatCompletion({
      path: "/api/documents/ai",
      model: AI_MODEL,
      max_completion_tokens: 8192,
      stream: true,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) { chars += content.length; res.write(`data: ${JSON.stringify({ content })}\n\n`); }
    }
    await recordUsage(ownerId, "ai_tokens", Math.ceil(chars / 4));
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const message = errorMessage(error, "AI request failed.");
    if (!res.headersSent) return void res.status(502).json({ message });
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
