import { Router, type IRouter } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db, apiKeysTable } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";

const router: IRouter = Router();

export const AVAILABLE_PERMISSIONS = [
  "voice.read",
  "voice.write",
  "documents.read",
  "documents.write",
  "agents.run",
] as const;

type Permission = (typeof AVAILABLE_PERMISSIONS)[number];

const sanitizePermissions = (input: unknown): Permission[] => {
  if (!Array.isArray(input)) return [];
  const set = new Set(AVAILABLE_PERMISSIONS as readonly string[]);
  return input.filter((p): p is Permission => typeof p === "string" && set.has(p));
};

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function keyJson(row: typeof apiKeysTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    permissions: row.permissions,
    requestCount: row.requestCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    active: row.revokedAt === null,
  };
}

// ── GET /keys/permissions ──────────────────────────────────────────────────────
router.get("/keys/permissions", (_req, res) => {
  res.json({ permissions: AVAILABLE_PERMISSIONS });
});

// ── GET /keys ───────────────────────────────────────────────────────────────────
router.get("/keys", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const rows = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.ownerId, ownerId))
      .orderBy(sql`${apiKeysTable.createdAt} desc`);
    res.json({ keys: rows.map(keyJson) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load API keys.") });
  }
});

// ── POST /keys → create, return plaintext ONCE ─────────────────────────────────
router.post("/keys", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 80) {
    return void res.status(400).json({ message: "A key name is required (max 80 characters)." });
  }
  const permissions = sanitizePermissions(body.permissions);
  if (permissions.length === 0) {
    return void res.status(400).json({ message: "Select at least one permission scope." });
  }
  try {
    const secret = randomBytes(32).toString("hex"); // 64 hex chars
    const plaintext = `pv_live_${secret}`;
    const prefix = plaintext.slice(0, 12);
    const [row] = await db
      .insert(apiKeysTable)
      .values({ ownerId, name, prefix, keyHash: hashKey(plaintext), permissions })
      .returning();
    res.status(201).json({ key: keyJson(row!), plaintext });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to create API key.") });
  }
});

// ── PATCH /keys/:id → rename ──────────────────────────────────────────────────
router.patch("/keys/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const name = String((req.body as { name?: unknown })?.name ?? "").trim();
  if (!name || name.length > 80) {
    return void res.status(400).json({ message: "A key name is required (max 80 characters)." });
  }
  try {
    const [row] = await db
      .update(apiKeysTable)
      .set({ name })
      .where(and(eq(apiKeysTable.id, req.params.id!), eq(apiKeysTable.ownerId, ownerId)))
      .returning();
    if (!row) return void res.status(404).json({ message: "API key not found." });
    res.json({ key: keyJson(row) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to rename API key.") });
  }
});

// ── POST /keys/:id/revoke ──────────────────────────────────────────────────────
router.post("/keys/:id/revoke", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const [row] = await db
      .update(apiKeysTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeysTable.id, req.params.id!), eq(apiKeysTable.ownerId, ownerId), isNull(apiKeysTable.revokedAt)))
      .returning();
    if (!row) return void res.status(404).json({ message: "Active API key not found." });
    res.json({ key: keyJson(row) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to revoke API key.") });
  }
});

// ── POST /keys/verify → genuinely testable validity + permissions check ─────────
// The keys ARE verifiable: this endpoint hashes the presented key, matches an
// active (non-revoked) row, increments its counter and returns permissions.
router.post("/keys/verify", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const key = String((req.body as { key?: unknown })?.key ?? "").trim();
  if (!key) return void res.status(400).json({ message: "Provide a key to verify." });
  try {
    const [row] = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.ownerId, ownerId), eq(apiKeysTable.keyHash, hashKey(key))));
    if (!row) return void res.json({ valid: false, reason: "No matching key for this account." });
    if (row.revokedAt) return void res.json({ valid: false, reason: "This key has been revoked." });
    await db
      .update(apiKeysTable)
      .set({ requestCount: row.requestCount + 1, lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, row.id));
    res.json({ valid: true, prefix: row.prefix, name: row.name, permissions: row.permissions, requestCount: row.requestCount + 1 });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to verify API key.") });
  }
});

export default router;
