import { db, usageEventsTable } from "@workspace/db";

export type UsageMetric =
  | "ai_tokens"
  | "documents"
  | "storage_bytes"
  | "agent_runs"
  | "tts_seconds"
  | "api_requests";

/** Record a real metered usage event; never blocks the caller's response on failure. */
export async function recordUsage(ownerId: string, metric: UsageMetric, quantity: number, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await db.insert(usageEventsTable).values({ ownerId, metric, quantity: Math.max(0, Math.round(quantity)), meta });
  } catch {
    // Usage metering must never break the feature itself.
  }
}
