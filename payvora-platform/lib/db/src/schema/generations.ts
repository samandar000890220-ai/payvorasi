import { pgTable, text, boolean, integer, real, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * TTS generation records — the persistent History source of truth.
 * Audio bytes live on disk; audioPath references them. A record only reaches
 * status "completed" after the F5-TTS generation actually succeeded.
 */
export const generationsTable = pgTable("generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  voiceId: uuid("voice_id"),
  voiceName: text("voice_name").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  kind: text("kind").notNull().default("generation"), // generation | preview
  status: text("status").notNull().default("queued"), // queued | processing | completed | failed | cancelled
  progress: integer("progress").notNull().default(0),
  audioPath: text("audio_path"),
  durationSeconds: real("duration_seconds"),
  error: text("error"),
  favorite: boolean("favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
