import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * AI conversations, shared by AI Chat, agent playground runs, and the
 * document assistant. Owner-scoped like the rest of Payvora.
 * kind: chat | agent | document | support
 */
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  kind: text("kind").notNull().default("chat"),
  agentId: uuid("agent_id"),
  documentId: uuid("document_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
