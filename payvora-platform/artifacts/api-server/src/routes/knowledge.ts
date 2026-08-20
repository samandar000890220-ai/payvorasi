import { Router, type IRouter } from "express";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { db, knowledgeSourcesTable, type KnowledgeSource } from "@workspace/db";
import { sessionOwner, errorMessage } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { and, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const STORAGE_ROOT = path.resolve(process.env["KNOWLEDGE_STORAGE_DIR"] ?? path.resolve(process.cwd(), ".data", "knowledge"));
const MAX_BYTES = 20 * 1024 * 1024;

const srcJson = (s: KnowledgeSource) => ({
  id: s.id, folder: s.folder, name: s.name, kind: s.kind, mimeType: s.mimeType,
  sizeBytes: s.sizeBytes, status: s.status, error: s.error,
  hasText: Boolean(s.extractedText && s.extractedText.length > 0),
  textPreview: s.extractedText ? s.extractedText.slice(0, 500) : null,
  createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
});

const ownerDir = (ownerId: string): string => {
  const safe = ownerId.replace(/[^a-zA-Z0-9-]/g, "");
  if (!safe) throw new Error("Invalid session owner.");
  const dir = path.resolve(STORAGE_ROOT, safe);
  if (dir !== STORAGE_ROOT && !dir.startsWith(`${STORAGE_ROOT}${path.sep}`)) throw new Error("Invalid storage path.");
  return dir;
};

const extForName = (name: string): string => (name.split(".").pop() ?? "").toLowerCase();
const TEXT_EXTS = new Set(["txt", "md", "markdown", "json", "csv", "log", "tsv", "yaml", "yml"]);

/** Genuinely extract text where we can; honestly fail where we cannot. */
function extractText(name: string, mime: string | null, bytes: Buffer): { status: "ready" | "failed"; text?: string; error?: string } {
  const ext = extForName(name);
  const isText = TEXT_EXTS.has(ext) || (mime ?? "").startsWith("text/") || mime === "application/json";
  if (isText) {
    try {
      const text = bytes.toString("utf-8");
      if (ext === "json") { try { JSON.parse(text); } catch { /* still store raw */ } }
      return { status: "ready", text };
    } catch (err) {
      return { status: "failed", error: errorMessage(err, "Could not decode file as UTF-8 text.") };
    }
  }
  if (ext === "pdf" || mime === "application/pdf") return { status: "failed", error: "PDF text extraction not installed." };
  if (ext === "docx" || ext === "doc" || (mime ?? "").includes("word")) return { status: "failed", error: "Word document text extraction not installed." };
  return { status: "failed", error: `Text extraction is not supported for .${ext || "this"} files.` };
}

// ── List / search ─────────────────────────────────────────────────────────────
router.get("/knowledge", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.ownerId, ownerId)).orderBy(desc(knowledgeSourcesTable.updatedAt));
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const folder = req.query.folder ? String(req.query.folder) : undefined;
  let filtered = rows;
  if (folder && folder !== "All") filtered = filtered.filter(s => s.folder === folder);
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search) || (s.extractedText ?? "").toLowerCase().includes(search));
  const folders = Array.from(new Set(rows.map(s => s.folder))).sort();
  res.json({ sources: filtered.map(srcJson), folders });
});

router.get("/knowledge/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.select().from(knowledgeSourcesTable).where(and(eq(knowledgeSourcesTable.id, req.params.id), eq(knowledgeSourcesTable.ownerId, ownerId)));
  if (!row) return void res.status(404).json({ message: "Source not found." });
  res.json({ ...srcJson(row), extractedText: row.extractedText });
});

// ── Upload raw bytes ──────────────────────────────────────────────────────────
router.post("/knowledge/upload", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const fileName = String(req.header("x-file-name") ?? "").trim();
  if (!fileName || fileName.length > 260) return void res.status(400).json({ message: "x-file-name header is required." });
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return void res.status(400).json({ message: "Invalid file name." });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return void res.status(415).json({ message: "Send file bytes with Content-Type application/octet-stream." });
  if (req.body.length > MAX_BYTES) return void res.status(413).json({ message: "File exceeds the 20MB limit." });
  const folder = String(req.header("x-folder") ?? "General").trim().slice(0, 80) || "General";
  const mime = req.header("content-type") ?? null;
  const bytes = req.body as Buffer;

  try {
    const dir = ownerDir(ownerId);
    await mkdir(dir, { recursive: true });
    const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const filePath = path.join(dir, stored);
    await writeFile(filePath, bytes);
    const extraction = extractText(fileName, mime === "application/octet-stream" ? null : mime, bytes);
    const [row] = await db.insert(knowledgeSourcesTable).values({
      ownerId, folder, name: fileName, kind: "file", mimeType: mime, sizeBytes: bytes.length,
      filePath, extractedText: extraction.text ?? null, status: extraction.status, error: extraction.error ?? null,
    }).returning();
    await recordUsage(ownerId, "storage_bytes", bytes.length);
    res.status(201).json(srcJson(row));
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Upload failed.") });
  }
});

// ── Paste text source ──────────────────────────────────────────────────────────
router.post("/knowledge/text", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { name?: unknown; text?: unknown; folder?: unknown };
  const name = String(body.name ?? "").trim();
  const text = String(body.text ?? "");
  if (!name || name.length > 200) return void res.status(422).json({ message: "A name (1–200 chars) is required." });
  if (!text.trim()) return void res.status(422).json({ message: "Text content cannot be empty." });
  const folder = String(body.folder ?? "General").trim().slice(0, 80) || "General";
  const bytes = Buffer.byteLength(text, "utf-8");
  const [row] = await db.insert(knowledgeSourcesTable).values({
    ownerId, folder, name, kind: "text", mimeType: "text/plain", sizeBytes: bytes,
    extractedText: text, status: "ready",
  }).returning();
  res.status(201).json(srcJson(row));
});

// ── Re-process (re-run extraction) ────────────────────────────────────────────
router.post("/knowledge/:id/reprocess", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.select().from(knowledgeSourcesTable).where(and(eq(knowledgeSourcesTable.id, req.params.id), eq(knowledgeSourcesTable.ownerId, ownerId)));
  if (!row) return void res.status(404).json({ message: "Source not found." });
  if (row.kind === "text") {
    const [updated] = await db.update(knowledgeSourcesTable).set({ status: "ready", error: null })
      .where(and(eq(knowledgeSourcesTable.id, row.id), eq(knowledgeSourcesTable.ownerId, ownerId))).returning();
    return void res.json(srcJson(updated));
  }
  if (!row.filePath) return void res.status(422).json({ message: "No stored file to reprocess." });
  try {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(row.filePath);
    const extraction = extractText(row.name, row.mimeType, bytes);
    const [updated] = await db.update(knowledgeSourcesTable).set({
      extractedText: extraction.text ?? null, status: extraction.status, error: extraction.error ?? null,
    }).where(and(eq(knowledgeSourcesTable.id, row.id), eq(knowledgeSourcesTable.ownerId, ownerId))).returning();
    res.json(srcJson(updated));
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Reprocess failed.") });
  }
});

router.delete("/knowledge/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.delete(knowledgeSourcesTable)
    .where(and(eq(knowledgeSourcesTable.id, req.params.id), eq(knowledgeSourcesTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Source not found." });
  if (row.filePath) { try { await rm(row.filePath, { force: true }); } catch { /* best effort */ } }
  res.status(204).end();
});

export default router;
