import { Router, type IRouter } from "express";
import { db, appIntegrationsTable, integrationLogsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { F5TtsClient } from "../voice/f5tts/client";

const router: IRouter = Router();

// ── SSRF guard for webhook test delivery ───────────────────────────────────────
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const isPrivateIp = (ip: string): boolean => {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("::ffff:");
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168);
};

export const checkWebhookTarget = async (rawUrl: string): Promise<string | null> => {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return "Webhook URL is invalid."; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "Webhook URL must use http or https.";
  const host = parsed.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return "Webhook URL must point to a public host.";
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addrs.some(a => isPrivateIp(a.address))) return "Webhook URL must resolve to a public IP address (private/internal addresses are blocked).";
  } catch {
    return "Webhook host could not be resolved.";
  }
  return null;
};

const WEBHOOK_EVENTS = ["document.created", "generation.completed", "agent.run"] as const;
type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const sanitizeEvents = (input: unknown): WebhookEvent[] => {
  if (!Array.isArray(input)) return [];
  const set = new Set(WEBHOOK_EVENTS as readonly string[]);
  return input.filter((e): e is WebhookEvent => typeof e === "string" && set.has(e));
};

// ── GET /integrations/status → REAL connection statuses ─────────────────────────
router.get("/integrations/status", async (_req, res) => {
  const client = new F5TtsClient();
  const health = await client.health(5000);

  const openaiConfigured = Boolean(process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"]);

  res.json({
    providers: [
      {
        slug: "f5-tts-worker",
        name: "F5-TTS Voice Worker",
        category: "Voice",
        connected: client.configured && health.reachable,
        configured: client.configured,
        status: !client.configured ? "not_configured" : health.reachable ? "live" : "unreachable",
        detail: health.detail,
        model: process.env["F5_TTS_MODEL"] ?? "F5TTS_v1_Base",
        device: process.env["F5_TTS_DEVICE"] ?? "auto",
      },
      {
        slug: "openai",
        name: "OpenAI (via Replit)",
        category: "AI",
        connected: openaiConfigured,
        configured: openaiConfigured,
        status: openaiConfigured ? "live" : "not_configured",
        detail: openaiConfigured
          ? "OpenAI integration endpoint is configured via Replit."
          : "AI_INTEGRATIONS_OPENAI_BASE_URL is not set.",
      },
      {
        slug: "github",
        name: "GitHub",
        category: "Developer",
        connected: true,
        configured: true,
        status: "connected",
        detail: "Connected through the Replit GitHub connector for source control.",
      },
    ],
  });
});

// ── Available catalog (honest: not connectable yet) ─────────────────────────────
router.get("/integrations/catalog", (_req, res) => {
  res.json({
    integrations: [
      { slug: "stripe", name: "Stripe", category: "Payments", reason: "No payment/OAuth infrastructure connected yet." },
      { slug: "slack", name: "Slack", category: "Messaging", reason: "OAuth connection flow is not available yet." },
      { slug: "google-drive", name: "Google Drive", category: "Storage", reason: "OAuth connection flow is not available yet." },
      { slug: "notion", name: "Notion", category: "Docs", reason: "OAuth connection flow is not available yet." },
      { slug: "zapier", name: "Zapier", category: "Automation", reason: "OAuth connection flow is not available yet." },
    ],
  });
});

// ── Webhooks CRUD ───────────────────────────────────────────────────────────────
function webhookJson(row: typeof appIntegrationsTable.$inferSelect) {
  const cfg = row.config as { url?: string; events?: string[] };
  return {
    id: row.id,
    name: row.name,
    url: cfg.url ?? "",
    events: Array.isArray(cfg.events) ? cfg.events : [],
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/integrations/webhook-events", (_req, res) => {
  res.json({ events: WEBHOOK_EVENTS });
});

router.get("/integrations/webhooks", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const rows = await db
      .select()
      .from(appIntegrationsTable)
      .where(and(eq(appIntegrationsTable.ownerId, ownerId), eq(appIntegrationsTable.slug, "webhook")))
      .orderBy(sql`${appIntegrationsTable.createdAt} desc`);
    res.json({ webhooks: rows.map(webhookJson) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load webhooks.") });
  }
});

router.post("/integrations/webhooks", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const url = String(body.url ?? "").trim();
  const events = sanitizeEvents(body.events);
  if (!name || name.length > 80) return void res.status(400).json({ message: "A webhook name is required (max 80 characters)." });
  if (!/^https?:\/\/.+/i.test(url)) return void res.status(400).json({ message: "Enter a valid http(s) URL." });
  if (events.length === 0) return void res.status(400).json({ message: "Select at least one event." });
  try {
    const [row] = await db
      .insert(appIntegrationsTable)
      .values({ ownerId, slug: "webhook", name, status: "connected", config: { url, events } })
      .returning();
    res.status(201).json({ webhook: webhookJson(row!) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to create webhook.") });
  }
});

router.put("/integrations/webhooks/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const url = String(body.url ?? "").trim();
  const events = sanitizeEvents(body.events);
  if (!name || name.length > 80) return void res.status(400).json({ message: "A webhook name is required (max 80 characters)." });
  if (!/^https?:\/\/.+/i.test(url)) return void res.status(400).json({ message: "Enter a valid http(s) URL." });
  if (events.length === 0) return void res.status(400).json({ message: "Select at least one event." });
  try {
    const [row] = await db
      .update(appIntegrationsTable)
      .set({ name, config: { url, events } })
      .where(and(eq(appIntegrationsTable.id, req.params.id!), eq(appIntegrationsTable.ownerId, ownerId), eq(appIntegrationsTable.slug, "webhook")))
      .returning();
    if (!row) return void res.status(404).json({ message: "Webhook not found." });
    res.json({ webhook: webhookJson(row) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to update webhook.") });
  }
});

router.delete("/integrations/webhooks/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const [row] = await db
      .delete(appIntegrationsTable)
      .where(and(eq(appIntegrationsTable.id, req.params.id!), eq(appIntegrationsTable.ownerId, ownerId), eq(appIntegrationsTable.slug, "webhook")))
      .returning();
    if (!row) return void res.status(404).json({ message: "Webhook not found." });
    await db.delete(integrationLogsTable).where(and(eq(integrationLogsTable.integrationId, row.id), eq(integrationLogsTable.ownerId, ownerId)));
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to delete webhook.") });
  }
});

// ── POST /integrations/webhooks/:id/test → real delivery + log ─────────────────
router.post("/integrations/webhooks/:id/test", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const [row] = await db
      .select()
      .from(appIntegrationsTable)
      .where(and(eq(appIntegrationsTable.id, req.params.id!), eq(appIntegrationsTable.ownerId, ownerId), eq(appIntegrationsTable.slug, "webhook")));
    if (!row) return void res.status(404).json({ message: "Webhook not found." });
    const cfg = row.config as { url?: string };
    const url = cfg.url ?? "";
    if (!/^https?:\/\/.+/i.test(url)) return void res.status(400).json({ message: "Webhook URL is invalid." });
    const ssrfError = await checkWebhookTarget(url);
    if (ssrfError) return void res.status(400).json({ message: ssrfError });

    const payload = {
      type: "webhook.test",
      webhookId: row.id,
      deliveredAt: new Date().toISOString(),
      data: { message: "This is a test event from Payvora." },
    };

    let level: "info" | "error" = "info";
    let message: string;
    let ok = false;
    let httpStatus: number | null = null;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Payvora-Webhook/1.0" },
        body: JSON.stringify(payload),
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      httpStatus = response.status;
      ok = response.ok;
      message = ok ? `Delivered — endpoint responded HTTP ${response.status}.` : `Endpoint responded HTTP ${response.status}.`;
      if (!ok) level = "error";
    } catch (err) {
      level = "error";
      message = `Delivery failed: ${err instanceof Error ? err.message : "network error"}.`;
    }

    await db.insert(integrationLogsTable).values({ integrationId: row.id, ownerId, level, message });
    await recordUsage(ownerId, "api_requests", 1, { source: "webhook_test", webhookId: row.id });

    res.status(ok ? 200 : 502).json({ delivered: ok, httpStatus, message });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to send test event.") });
  }
});

// ── Delivery log viewer ─────────────────────────────────────────────────────────
router.get("/integrations/webhooks/:id/logs", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const [row] = await db
      .select()
      .from(appIntegrationsTable)
      .where(and(eq(appIntegrationsTable.id, req.params.id!), eq(appIntegrationsTable.ownerId, ownerId)));
    if (!row) return void res.status(404).json({ message: "Webhook not found." });
    const logs = await db
      .select()
      .from(integrationLogsTable)
      .where(and(eq(integrationLogsTable.integrationId, req.params.id!), eq(integrationLogsTable.ownerId, ownerId)))
      .orderBy(sql`${integrationLogsTable.createdAt} desc`)
      .limit(50);
    res.json({
      logs: logs.map(l => ({ id: l.id, level: l.level, message: l.message, createdAt: l.createdAt.toISOString() })),
    });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load delivery logs.") });
  }
});

export default router;
