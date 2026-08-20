import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Knowledge base sources. File bytes live on disk (KNOWLEDGE_STORAGE_DIR);
 * extracted text is stored here so AI features can genuinely use it.
 */
export const knowledgeSourcesTable = pgTable("knowledge_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  folder: text("folder").notNull().default("General"),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("file"), // file | text | url
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  filePath: text("file_path"),
  extractedText: text("extracted_text"),
  status: text("status").notNull().default("processing"), // processing | ready | failed
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeSource = z.infer<typeof insertKnowledgeSourceSchema>;
export type KnowledgeSource = typeof knowledgeSourcesTable.$inferSelect;
