import { Router, type IRouter } from "express";
import { db, conversations, messages as messagesTable, supportTicketsTable, supportMessagesTable } from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { createCanonicalChatCompletion } from "../ai/request";

const router: IRouter = Router();

// ── Help articles: genuine documentation of real Payvora features ─────────────
const ARTICLES: Array<{ slug: string; title: string; category: string; summary: string; body: string }> = [
  {
    slug: "getting-started",
    title: "Getting started with Payvora",
    category: "Basics",
    summary: "An overview of the Payvora workspace and its core studios.",
    body: "Payvora is an AI content workspace. From the sidebar you can open AI Chat, the Voice, Image and Video studios, Document Studio, AI Agents, Templates, the Knowledge Base, and Projects. Each area saves your work to your own session automatically. Use the theme toggle to switch between light and dark, and Settings to manage preferences.",
  },
  {
    slug: "voice-cloning",
    title: "Cloning a voice with F5-TTS",
    category: "Voice Studio",
    summary: "Upload a reference recording and generate speech in that voice.",
    body: "Voice Studio uses an F5-TTS worker for zero-shot voice cloning. Upload a clean reference recording (a few seconds of clear speech) and optionally provide the reference transcript to improve accuracy. You can then type text and generate speech in that cloned voice. Supported controls are speed, pitch, and energy; stability, similarity, emotion, and non-speech vocal events are not supported by this backend. Insert pauses with [pause:seconds] tags. Output is available as WAV or MP3.",
  },
  {
    slug: "documents",
    title: "Writing with Document Studio",
    category: "Documents",
    summary: "Create AI-assisted rich-text documents with version history.",
    body: "Document Studio lets you create and edit rich-text documents. Documents are organized into folders, can be marked as favorites, and keep a version snapshot each time you save so you can review earlier drafts. Word counts are tracked automatically.",
  },
  {
    slug: "ai-agents",
    title: "Building and deploying AI Agents",
    category: "AI Agents",
    summary: "Configure a model, system prompt, memory and knowledge, then test in the playground.",
    body: "AI Agents let you configure a reusable assistant. Choose a model (gpt-5.6-terra, gpt-5.6-luna, or gpt-5-mini), write a system prompt, toggle conversation memory, and attach knowledge sources from your Knowledge Base so the agent can reference their extracted text. Some tool permissions are reserved and marked as not yet executable. Move an agent through draft, deployed, and paused states — each transition is logged. Use the playground to chat with the agent and see run counts and performance metrics computed from real logs.",
  },
  {
    slug: "knowledge-base",
    title: "Using the Knowledge Base",
    category: "Knowledge Base",
    summary: "Upload sources whose extracted text powers AI features.",
    body: "The Knowledge Base stores sources (files, text, or URLs). Payvora extracts their text so AI features — such as AI Agents — can genuinely reference the content. Each source shows a processing/ready/failed status. Attach ready sources to an agent to ground its answers.",
  },
  {
    slug: "templates",
    title: "Working with Templates",
    category: "Templates",
    summary: "Reusable starting points for your content.",
    body: "Templates give you reusable starting points so you do not begin from a blank page. Browse the template gallery and use one to seed a new piece of work.",
  },
  {
    slug: "projects",
    title: "Organizing work with Projects",
    category: "Projects",
    summary: "Track progress, contacts, and linked documents.",
    body: "Projects help you organize work. Each project has a name, description, status (active, paused, completed, or archived), and a progress indicator. Add contact entries (name, email, role) to record who is involved — note these are contacts, not login users, because Payvora has no separate auth system yet. Link documents from Document Studio, and review an activity timeline that records every change automatically.",
  },
  {
    slug: "ai-chat",
    title: "Chatting with the AI assistant",
    category: "AI Chat",
    summary: "Have streaming conversations that are saved automatically.",
    body: "AI Chat gives you a streaming conversation with Payvora's assistant. Conversations are saved and titled automatically from your first message. You can rename or delete conversations at any time, and stop a response mid-stream if you change your mind.",
  },
  {
    slug: "billing-usage",
    title: "Understanding billing and usage",
    category: "Billing",
    summary: "How metered usage is recorded.",
    body: "Payvora records real usage as you work: AI tokens, documents, storage, agent runs, and generated speech seconds. These metered events power the Billing area so your usage reflects genuine activity rather than estimates.",
  },
  {
    slug: "support-tickets",
    title: "Getting help and raising tickets",
    category: "Support",
    summary: "Use the AI assistant or open a support ticket.",
    body: "The Help & Support center offers an AI support assistant that knows Payvora's real capabilities and will tell you when it is unsure. If you need a human follow-up, open a support ticket with a subject, priority, and first message. You can reply within the ticket thread and close or reopen it as needed.",
  },
];

const SUPPORT_TASK_CONTEXT = `You are Payvora's support assistant. You help users understand and use Payvora, an AI content workspace with these REAL capabilities:
- Voice Studio: zero-shot voice cloning via an F5-TTS worker. Controls: speed, pitch, energy, and [pause:seconds] tags. It does NOT support stability, similarity, emotion, or non-speech vocal events.
- Document Studio: AI-assisted rich-text documents with folders, favorites, and version history.
- AI Agents: configurable assistants (models gpt-5.6-terra, gpt-5.6-luna, gpt-5-mini), system prompts, optional memory, and knowledge attachment. Some tool permissions are reserved and not yet executable.
- Knowledge Base: sources whose extracted text grounds AI features.
- Templates: reusable content starting points.
- Projects: name, description, status, progress, contact members, linked documents, and an activity timeline.
- AI Chat: streaming saved conversations.
- Billing: real metered usage (AI tokens, documents, storage, agent runs, speech seconds).
Be concise, accurate, and friendly. If you do not know the answer or a capability is not listed above, say clearly that you are not sure rather than guessing.`;

type TicketRow = typeof supportTicketsTable.$inferSelect;
type SupportMsgRow = typeof supportMessagesTable.$inferSelect;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const ticketJson = (t: TicketRow) => ({
  id: t.id, subject: t.subject, status: t.status, priority: t.priority,
  createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
});
const supportMsgJson = (m: SupportMsgRow) => ({
  id: m.id, ticketId: m.ticketId, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(),
});

// ── Help articles ──────────────────────────────────────────────────────────────
router.get("/support/articles", (req, res) => {
  const q = String((req.query.q ?? "")).toLowerCase().trim();
  const filtered = q
    ? ARTICLES.filter(a => (a.title + a.summary + a.body + a.category).toLowerCase().includes(q))
    : ARTICLES;
  res.json({ articles: filtered.map(({ slug, title, category, summary }) => ({ slug, title, category, summary })) });
});

router.get("/support/articles/:slug", (req, res) => {
  const article = ARTICLES.find(a => a.slug === req.params.slug);
  if (!article) return void res.status(404).json({ message: "Article not found." });
  res.json(article);
});

// ── Support AI assistant (kind=support conversation) ──────────────────────────
router.get("/support/assistant", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  let [convo] = await db.select().from(conversations).where(and(eq(conversations.ownerId, ownerId), eq(conversations.kind, "support"))).orderBy(desc(conversations.createdAt));
  if (!convo) {
    [convo] = await db.insert(conversations).values({ ownerId, kind: "support", title: "Support assistant" }).returning();
  }
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, convo.id)).orderBy(asc(messagesTable.id));
  res.json({
    conversationId: convo.id,
    messages: msgs.map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })),
  });
});

router.post("/support/assistant", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const content = String((req.body as { content?: unknown }).content ?? "").trim();
  if (!content) return void res.status(422).json({ message: "A message is required." });

  let [convo] = await db.select().from(conversations).where(and(eq(conversations.ownerId, ownerId), eq(conversations.kind, "support"))).orderBy(desc(conversations.createdAt));
  if (!convo) {
    [convo] = await db.insert(conversations).values({ ownerId, kind: "support", title: "Support assistant" }).returning();
  }
  await db.insert(messagesTable).values({ conversationId: convo.id, role: "user", content });

  const history = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, convo.id)).orderBy(asc(messagesTable.id));
  const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content } as const)),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let assembled = "";
  try {
    const stream = await createCanonicalChatCompletion({
      path: "/api/support/assistant",
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: "system", content: SUPPORT_TASK_CONTEXT }, ...aiMessages],
    });
    let usageTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        assembled += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
      if (chunk.usage?.total_tokens) usageTokens = chunk.usage.total_tokens;
    }
    if (assembled.trim()) await db.insert(messagesTable).values({ conversationId: convo.id, role: "assistant", content: assembled });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    const tokens = usageTokens > 0 ? usageTokens : Math.ceil((JSON.stringify(aiMessages).length + assembled.length) / 4);
    await recordUsage(ownerId, "ai_tokens", tokens, { feature: "support_assistant" });
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ message: errorMessage(error, "AI request failed.") });
    else { res.write(`data: ${JSON.stringify({ error: errorMessage(error, "AI request failed.") })}\n\n`); res.end(); }
  }
});

// ── Support tickets ──────────────────────────────────────────────────────────
router.get("/support/tickets", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.ownerId, ownerId)).orderBy(desc(supportTicketsTable.updatedAt));
  res.json({ tickets: rows.map(ticketJson) });
});

router.post("/support/tickets", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { subject?: unknown; priority?: unknown; message?: unknown };
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const priority = String(body.priority ?? "normal");
  if (!subject || subject.length > 200) return void res.status(422).json({ message: "Subject is required and must be 200 characters or fewer." });
  if (!message) return void res.status(422).json({ message: "A first message is required." });
  if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) return void res.status(422).json({ message: "Invalid priority." });
  const [ticket] = await db.insert(supportTicketsTable).values({ ownerId, subject, priority }).returning();
  await db.insert(supportMessagesTable).values({ ticketId: ticket.id, ownerId, role: "user", content: message });
  res.status(201).json(ticketJson(ticket));
});

router.get("/support/tickets/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [ticket] = await db.select().from(supportTicketsTable).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.ownerId, ownerId)));
  if (!ticket) return void res.status(404).json({ message: "Ticket not found." });
  const msgs = await db.select().from(supportMessagesTable).where(and(eq(supportMessagesTable.ticketId, req.params.id), eq(supportMessagesTable.ownerId, ownerId))).orderBy(asc(supportMessagesTable.createdAt));
  res.json({ ticket: ticketJson(ticket), messages: msgs.map(supportMsgJson) });
});

router.post("/support/tickets/:id/messages", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [ticket] = await db.select().from(supportTicketsTable).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.ownerId, ownerId)));
  if (!ticket) return void res.status(404).json({ message: "Ticket not found." });
  const content = String((req.body as { content?: unknown }).content ?? "").trim();
  if (!content) return void res.status(422).json({ message: "Reply content is required." });
  const [msg] = await db.insert(supportMessagesTable).values({ ticketId: ticket.id, ownerId, role: "user", content }).returning();
  await db.update(supportTicketsTable).set({ status: ticket.status === "closed" || ticket.status === "resolved" ? "open" : ticket.status }).where(and(eq(supportTicketsTable.id, ticket.id), eq(supportTicketsTable.ownerId, ownerId)));
  res.status(201).json(supportMsgJson(msg));
});

router.post("/support/tickets/:id/status", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const status = String((req.body as { status?: unknown }).status ?? "");
  const allowed = ["open", "pending", "resolved", "closed"];
  if (!allowed.includes(status)) return void res.status(422).json({ message: "Invalid status." });
  const [ticket] = await db.update(supportTicketsTable).set({ status }).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.ownerId, ownerId))).returning();
  if (!ticket) return void res.status(404).json({ message: "Ticket not found." });
  res.json(ticketJson(ticket));
});

export default router;
