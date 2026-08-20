import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Cloned/reference voices. Audio bytes live on disk (VOICE_STORAGE_DIR);
 * this table is the persistent metadata source of truth.
 * ownerId is a session-scoped identifier today; a real user FK can replace it later.
 */
export const voicesTable = pgTable("voices", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("cloned"),
  audioPath: text("audio_path").notNull(),
  referenceText: text("reference_text"),
  avatarUrl: text("avatar_url"),
  favorite: boolean("favorite").notNull().default(false),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVoiceSchema = createInsertSchema(voicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVoice = z.infer<typeof insertVoiceSchema>;
export type Voice = typeof voicesTable.$inferSelect;
