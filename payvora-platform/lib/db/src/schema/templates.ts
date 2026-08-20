import { pgTable, text, boolean, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Template marketplace. Built-in templates have ownerId = "__builtin__" and are
 * visible to everyone; user-created templates are owner-scoped.
 */
export const templatesTable = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("business"), // business | finance | document | workflow
  description: text("description").notNull().default(""),
  content: text("content").notNull().default(""),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-owner template favorites (built-ins can be favorited too). */
export const templateFavoritesTable = pgTable("template_favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  templateId: uuid("template_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true, useCount: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
export type TemplateFavorite = typeof templateFavoritesTable.$inferSelect;
export const BUILTIN_OWNER = "__builtin__";
