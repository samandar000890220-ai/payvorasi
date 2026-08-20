import { Router, type IRouter } from "express";
import { db, conversations, messages as messagesTable } from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { createCanonicalChatCompletion } from "../ai/request";

const router: IRouter = Router();
const GENERATED_IMAGE_PREFIX = "__PAYVORA_GENERATED_IMAGE__:";

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messagesTable.$inferSelect;

// Keep image generation explicit so ordinary chat prompts remain on the
// existing text path. This is intentionally shared in spirit with the client
// check; the backend remains authoritative for whether an image is generated.
export const isImageGenerationPrompt = (content: string): boolean =>
  /\b(?:generate|create|make|draw|illustrate|render|paint|design)\b[\s\S]{0,100}\b(?:image|picture|photo|illustration|artwork|visual)\b|\b(?:image|picture|photo|illustration|artwork|visual)\b[\s\S]{0,100}\b(?:generate|create|make|draw|illustrate|render|paint)\b/i.test(content);

const imageMessageContent = (prompt: string, dataUrl: string) =>
  `${GENERATED_IMAGE_PREFIX}${JSON.stringify({ prompt, dataUrl })}`;

const conversationJson = (c: ConversationRow) => ({
  id: c.id,
  kind: c.kind,
  title: c.title,
  agentId: c.agentId,
  documentId: c.documentId,
  createdAt: c.createdAt.toISOString(),
});

const messageJson = (m: MessageRow) => ({
  id: m.id,
  conversationId: m.conversationId,
  role: m.role,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

async function ownedConversation(ownerId: string, id: number): Promise<ConversationRow | undefined> {
  const [row] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.ownerId, ownerId), eq(conversations.kind, "chat")));
  return row;
}

// ── Conversations ────────────────────────────────────────────────────────────
router.get("/chat/conversations", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const rows = await db.select().from(conversations).where(and(eq(conversations.ownerId, ownerId), eq(conversations.kind, "chat"))).orderBy(desc(conversations.createdAt));
  res.json({ conversations: rows.map(conversationJson) });
});

router.post("/chat/conversations", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const title = String((req.body as { title?: unknown }).title ?? "New conversation").trim().slice(0, 120) || "New conversation";
  const [row] = await db.insert(conversations).values({ ownerId, kind: "chat", title }).returning();
  res.status(201).json(conversationJson(row));
});

router.patch("/chat/conversations/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ message: "Invalid conversation id." });
  const title = String((req.body as { title?: unknown }).title ?? "").trim().slice(0, 120);
  if (!title) return void res.status(422).json({ message: "Title is required." });
  const [row] = await db.update(conversations).set({ title }).where(and(eq(conversations.id, id), eq(conversations.ownerId, ownerId), eq(conversations.kind, "chat"))).returning();
  if (!row) return void res.status(404).json({ message: "Conversation not found." });
  res.json(conversationJson(row));
});

router.delete("/chat/conversations/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ message: "Invalid conversation id." });
  const [row] = await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.ownerId, ownerId), eq(conversations.kind, "chat"))).returning();
  if (!row) return void res.status(404).json({ message: "Conversation not found." });
  res.status(204).end();
});

// ── Messages ──────────────────────────────────────────────────────────────────
router.get("/chat/conversations/:id/messages", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ message: "Invalid conversation id." });
  const convo = await ownedConversation(ownerId, id);
  if (!convo) return void res.status(404).json({ message: "Conversation not found." });
  const rows = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.id));
  res.json({ messages: rows.map(messageJson) });
});

// ── Send a message → SSE streamed AI reply, both sides persisted ──────────────
router.post("/chat/conversations/:id/messages", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ message: "Invalid conversation id." });
  const convo = await ownedConversation(ownerId, id);
  if (!convo) return void res.status(404).json({ message: "Conversation not found." });

  const content = String((req.body as { content?: unknown }).content ?? "").trim();
  if (!content) return void res.status(422).json({ message: "Message content is required." });

  // Persist the user message immediately.
  await db.insert(messagesTable).values({ conversationId: id, role: "user", content });

  // Auto-title from the first user message.
  const priorCount = (await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id))).length;
  if (priorCount <= 1 && (convo.title === "New conversation" || !convo.title.trim())) {
    await db.update(conversations).set({ title: content.slice(0, 60) }).where(and(eq(conversations.id, id), eq(conversations.ownerId, ownerId)));
  }

  if (isImageGenerationPrompt(content)) {
    const abort = new AbortController();
    res.on("close", () => { if (!res.writableEnded) abort.abort(); });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const emit = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    emit({ status: "generating" });
    try {
      // This status is emitted by the server while the real image request is
      // in flight, not by a frontend timer. Completion still depends on the
      // actual provider response below.
      emit({ status: "sketching" });
      const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
      const imageBuffer = await generateImageBuffer(content, "1024x1024", { signal: abort.signal });
      if (!imageBuffer.length) throw new Error("Image generation returned no image data.");

      const dataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
      await db.insert(messagesTable).values({
        conversationId: id,
        role: "assistant",
        content: imageMessageContent(content, dataUrl),
      });
      emit({ image: { prompt: content, dataUrl } });
      emit({ done: true });
      res.end();
      await recordUsage(ownerId, "api_requests", 1, { feature: "image-generation", conversationId: id });
    } catch (error) {
      if (abort.signal.aborted) return;
      emit({ error: errorMessage(error, "Image generation failed.") });
      res.end();
    }
    return;
  }

  const history = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.id));
  const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content } as const)),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let assembled = "";
  // Abort upstream generation when the client disconnects (Stop button / closed tab)
  // so the saved transcript matches what was actually delivered.
  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });
  try {
    const stream = await createCanonicalChatCompletion({
      path: "/api/chat/conversations/:id/messages",
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      stream: true,
      stream_options: { include_usage: true },
      messages: aiMessages,
      signal: abort.signal,
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
    if (assembled.trim()) await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: assembled });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    const tokens = usageTokens > 0 ? usageTokens : Math.ceil((JSON.stringify(aiMessages).length + assembled.length) / 4);
    await recordUsage(ownerId, "ai_tokens", tokens, { feature: "chat", conversationId: id });
  } catch (error) {
    if (abort.signal.aborted) {
      // Client stopped generation — persist only what was delivered, marked as stopped.
      if (assembled.trim()) await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: assembled + "\n\n_[stopped by user]_" }).catch(() => {});
      return;
    }
    if (!res.headersSent) {
      res.status(502).json({ message: errorMessage(error, "AI request failed.") });
    } else {
      res.write(`data: ${JSON.stringify({ error: errorMessage(error, "AI request failed.") })}\n\n`);
      res.end();
    }
  }
});

export default router;
