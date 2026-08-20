import { pgTable, text, boolean, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** User-configured AI agents (model, prompt, tool permissions, memory). */
export const agentsTable = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model").notNull().default("gpt-5.6-terra"),
  systemPrompt: text("system_prompt").notNull().default(""),
  toolPermissions: jsonb("tool_permissions").$type<Record<string, boolean>>().notNull().default({}),
  memoryEnabled: boolean("memory_enabled").notNull().default(true),
  knowledgeSourceIds: jsonb("knowledge_source_ids").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("draft"), // draft | deployed | paused
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Activity log per agent (playground runs, deploy/pause events). */
export const agentLogsTable = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(), // run | deploy | pause | error
  summary: text("summary").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({ id: true, createdAt: true, updatedAt: true, runCount: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
export type AgentLog = typeof agentLogsTable.$inferSelect;
