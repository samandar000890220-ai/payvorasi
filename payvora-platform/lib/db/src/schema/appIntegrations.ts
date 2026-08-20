import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-owner state for the in-app integrations page: webhooks and API-style
 * integrations the user configures. External OAuth apps are NOT faked — the
 * catalog marks which providers are genuinely connectable today.
 */
export const appIntegrationsTable = pgTable("app_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  slug: text("slug").notNull(), // e.g. "webhook", "f5-tts-worker"
  name: text("name").notNull(),
  status: text("status").notNull().default("connected"), // connected | disabled | error
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Log lines for integration deliveries/health checks. */
export const integrationLogsTable = pgTable("integration_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  integrationId: uuid("integration_id").notNull(),
  ownerId: text("owner_id").notNull(),
  level: text("level").notNull().default("info"), // info | error
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppIntegrationSchema = createInsertSchema(appIntegrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppIntegration = z.infer<typeof insertAppIntegrationSchema>;
export type AppIntegration = typeof appIntegrationsTable.$inferSelect;
export type IntegrationLog = typeof integrationLogsTable.$inferSelect;
