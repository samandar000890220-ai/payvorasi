import { Router, type IRouter } from "express";
import { db, agentsTable, agentLogsTable, knowledgeSourcesTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { createCanonicalChatCompletion } from "../ai/request";

const router: IRouter = Router();

const MODELS = ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5-mini"] as const;
const STATUSES = ["draft", "deployed", "paused"] as const;

type AgentRow = typeof agentsTable.$inferSelect;

const agentJson = (a: AgentRow) => ({
  id: a.id,
  name: a.name,
  description: a.description,
  model: a.model,
  systemPrompt: a.systemPrompt,
  toolPermissions: a.toolPermissions,
  memoryEnabled: a.memoryEnabled,
  knowledgeSourceIds: a.knowledgeSourceIds,
  status: a.status,
  runCount: a.runCount,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

async function log(ownerId: string, agentId: string, kind: string, summary: string, detail: Record<string, unknown> = {}) {
  try {
    await db.insert(agentLogsTable).values({ ownerId, agentId, kind, summary, detail });
  } catch {
    /* logging must not break the feature */
  }
}

// ── Agents CRUD ────────────────────────────────────────────────────────────
router.get("/agents", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(agentsTable).where(eq(agentsTable.ownerId, ownerId)).orderBy(desc(agentsTable.updatedAt));
  res.json({ agents: rows.map(agentJson), models: MODELS });
});

router.post("/agents", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { name?: unknown };
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 80) return void res.status(422).json({ message: "Agent name is required and must be 80 characters or fewer." });
  try {
    const [row] = await db.insert(agentsTable).values({ ownerId, name }).returning();
    res.status(201).json(agentJson(row));
  } catch (error) {
    res.status(400).json({ message: errorMessage(error, "Could not create agent.") });
  }
});

router.get("/agents/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.select().from(agentsTable).where(and(eq(agentsTable.id, req.params.id), eq(agentsTable.ownerId, ownerId)));
  if (!row) return void res.status(404).json({ message: "Agent not found." });
  res.json(agentJson(row));
});

router.patch("/agents/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 80) return void res.status(422).json({ message: "Agent name must be 1–80 characters." });
    patch.name = name;
  }
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 500) || null;
  if (typeof body.model === "string") {
    if (!MODELS.includes(body.model as (typeof MODELS)[number])) return void res.status(422).json({ message: "Unknown model." });
    patch.model = body.model;
  }
  if (typeof body.systemPrompt === "string") patch.systemPrompt = body.systemPrompt.slice(0, 8000);
  if (body.toolPermissions && typeof body.toolPermissions === "object") {
    const raw = body.toolPermissions as Record<string, unknown>;
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw)) clean[k] = Boolean(v);
    patch.toolPermissions = clean;
  }
  if (typeof body.memoryEnabled === "boolean") patch.memoryEnabled = body.memoryEnabled;
  if (Array.isArray(body.knowledgeSourceIds)) patch.knowledgeSourceIds = body.knowledgeSourceIds.filter(x => typeof x === "string");
  if (Object.keys(patch).length === 0) return void res.status(422).json({ message: "Nothing to update." });
  const [row] = await db.update(agentsTable).set(patch).where(and(eq(agentsTable.id, req.params.id), eq(agentsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Agent not found." });
  res.json(agentJson(row));
});

router.post("/agents/:id/status", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const status = String((req.body as { status?: unknown }).status ?? "");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return void res.status(422).json({ message: "Status must be draft, deployed, or paused." });
  const [row] = await db.update(agentsTable).set({ status }).where(and(eq(agentsTable.id, req.params.id), eq(agentsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Agent not found." });
  const kind = status === "deployed" ? "deploy" : status === "paused" ? "pause" : "run";
  await log(ownerId, row.id, status === "draft" ? "deploy" : kind, `Agent status changed to ${status}.`, { status });
  res.json(agentJson(row));
});

router.delete("/agents/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.delete(agentsTable).where(and(eq(agentsTable.id, req.params.id), eq(agentsTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Agent not found." });
  await db.delete(agentLogsTable).where(and(eq(agentLogsTable.agentId, req.params.id), eq(agentLogsTable.ownerId, ownerId)));
  res.status(204).end();
});

// ── Activity log + performance metrics ───────────────────────────────────────
router.get("/agents/:id/logs", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [agent] = await db.select().from(agentsTable).where(and(eq(agentsTable.id, req.params.id), eq(agentsTable.ownerId, ownerId)));
  if (!agent) return void res.status(404).json({ message: "Agent not found." });
  const logs = await db.select().from(agentLogsTable).where(and(eq(agentLogsTable.agentId, req.params.id), eq(agentLogsTable.ownerId, ownerId))).orderBy(desc(agentLogsTable.createdAt)).limit(200);
  const runs = logs.filter(l => l.kind === "run");
  const errors = logs.filter(l => l.kind === "error");
  const lastRun = runs[0]?.createdAt?.toISOString() ?? null;
  res.json({
    logs: logs.map(l => ({ id: l.id, kind: l.kind, summary: l.summary, detail: l.detail, createdAt: l.createdAt.toISOString() })),
    metrics: { runs: agent.runCount, loggedRuns: runs.length, errorCount: errors.length, lastRun },
  });
});

// ── Playground: streaming chat with the agent ────────────────────────────────
router.post("/agents/:id/playground", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [agent] = await db.select().from(agentsTable).where(and(eq(agentsTable.id, req.params.id), eq(agentsTable.ownerId, ownerId)));
  if (!agent) return void res.status(404).json({ message: "Agent not found." });

  const body = req.body as { message?: unknown; history?: unknown };
  const userMessage = String(body.message ?? "").trim();
  if (!userMessage) return void res.status(422).json({ message: "A message is required." });

  const history = Array.isArray(body.history)
    ? (body.history as Array<{ role?: unknown; content?: unknown }>)
        .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-20)
    : [];

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  const systemPrompt = agent.systemPrompt.trim() || `You are ${agent.name}, a helpful AI agent.`;
  messages.push({ role: "system", content: systemPrompt });

  // Knowledge injection (real extracted text from the user's knowledge sources).
  if (agent.knowledgeSourceIds.length > 0) {
    try {
      const sources = await db
        .select()
        .from(knowledgeSourcesTable)
        .where(and(eq(knowledgeSourcesTable.ownerId, ownerId), inArray(knowledgeSourcesTable.id, agent.knowledgeSourceIds)));
      const excerpts = sources
        .filter(s => s.extractedText && s.extractedText.trim())
        .map(s => `Knowledge source "${s.name}":\n${(s.extractedText ?? "").slice(0, 4000)}`);
      if (excerpts.length > 0) {
        messages.push({ role: "system", content: `Use the following knowledge sources when relevant:\n\n${excerpts.join("\n\n---\n\n")}` });
      }
    } catch {
      /* if knowledge is unavailable, proceed without it */
    }
  }

  if (agent.memoryEnabled) {
    for (const m of history) messages.push({ role: m.role as "user" | "assistant", content: m.content as string });
  }
  messages.push({ role: "user", content: userMessage });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let assembled = "";
  try {
    const stream = await createCanonicalChatCompletion({
      path: "/api/agents/:id/run",
      model: agent.model,
      max_completion_tokens: 8192,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    });
    let usageTokens = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? "";
      if (content) {
        assembled += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
      if (chunk.usage?.total_tokens) usageTokens = chunk.usage.total_tokens;
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    const [updated] = await db.update(agentsTable).set({ runCount: agent.runCount + 1 }).where(and(eq(agentsTable.id, agent.id), eq(agentsTable.ownerId, ownerId))).returning();
    await log(ownerId, agent.id, "run", `Playground run: ${userMessage.slice(0, 60)}`, { chars: assembled.length });
    await recordUsage(ownerId, "agent_runs", 1, { agentId: agent.id });
    const tokens = usageTokens > 0 ? usageTokens : Math.ceil((JSON.stringify(messages).length + assembled.length) / 4);
    await recordUsage(ownerId, "ai_tokens", tokens, { agentId: agent.id, feature: "agent_playground" });
    void updated;
  } catch (error) {
    await log(ownerId, agent.id, "error", "Playground run failed.", { error: errorMessage(error, "AI request failed.") });
    if (!res.headersSent) {
      res.status(502).json({ message: errorMessage(error, "AI request failed.") });
    } else {
      res.write(`data: ${JSON.stringify({ error: errorMessage(error, "AI request failed.") })}\n\n`);
      res.end();
    }
  }
});

export default router;
