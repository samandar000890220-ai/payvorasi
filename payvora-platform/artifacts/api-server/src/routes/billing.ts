import { Router, type IRouter } from "express";
import {
  db,
  subscriptionsTable,
  invoicesTable,
  usageEventsTable,
  billingProfilesTable,
  documentsTable,
  generationsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";

const router: IRouter = Router();

// ── Plans ───────────────────────────────────────────────────────────────────
export type PlanLimits = {
  ai_tokens: number;
  documents: number;
  storage_bytes: number;
  agent_runs: number;
  tts_seconds: number;
  api_requests: number;
};

export type Plan = {
  id: string;
  name: string;
  priceCents: number | null; // null = contact sales
  contact?: boolean;
  tagline: string;
  limits: PlanLimits;
};

const MB = 1024 * 1024;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceCents: 0,
    tagline: "For trying Payvora out.",
    limits: { ai_tokens: 20_000, documents: 10, storage_bytes: 100 * MB, agent_runs: 20, tts_seconds: 60, api_requests: 1_000 },
  },
  {
    id: "starter",
    name: "Starter",
    priceCents: 1_900,
    tagline: "For individuals shipping regularly.",
    limits: { ai_tokens: 200_000, documents: 100, storage_bytes: 1_000 * MB, agent_runs: 200, tts_seconds: 600, api_requests: 10_000 },
  },
  {
    id: "professional",
    name: "Professional",
    priceCents: 4_900,
    tagline: "For teams that need headroom.",
    limits: { ai_tokens: 2_000_000, documents: 1_000, storage_bytes: 10_000 * MB, agent_runs: 2_000, tts_seconds: 6_000, api_requests: 100_000 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceCents: null,
    contact: true,
    tagline: "Custom limits, SLAs and support.",
    limits: { ai_tokens: 20_000_000, documents: 10_000, storage_bytes: 100_000 * MB, agent_runs: 20_000, tts_seconds: 60_000, api_requests: 1_000_000 },
  },
];

const planById = (id: string) => PLANS.find(p => p.id === id);

function subscriptionJson(row: typeof subscriptionsTable.$inferSelect) {
  const plan = planById(row.plan) ?? PLANS[0];
  return {
    plan: row.plan,
    planName: plan.name,
    status: row.status,
    renewsAt: row.renewsAt?.toISOString() ?? null,
    externalRef: row.externalRef,
    limits: plan.limits,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Fetch (or default-upsert) the owner's subscription row. */
async function ensureSubscription(ownerId: string) {
  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.ownerId, ownerId));
  if (existing) return existing;
  const [created] = await db
    .insert(subscriptionsTable)
    .values({ ownerId, plan: "free", status: "active" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.ownerId, ownerId));
  return row!;
}

// ── GET /billing/plans ────────────────────────────────────────────────────────
router.get("/billing/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

// ── GET /billing/subscription ──────────────────────────────────────────────────
router.get("/billing/subscription", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const row = await ensureSubscription(ownerId);
    res.json({ subscription: subscriptionJson(row) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load subscription.") });
  }
});

// ── POST /billing/change-plan ────────────────────────────────────────────────
router.post("/billing/change-plan", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const planId = String((req.body as { plan?: unknown })?.plan ?? "").trim();
  const plan = planById(planId);
  if (!plan) return void res.status(400).json({ message: "Unknown plan." });
  if (plan.contact) {
    return void res.status(400).json({ message: "Enterprise plans are set up by contacting sales — no self-serve change available." });
  }
  try {
    await ensureSubscription(ownerId);
    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ plan: plan.id, status: "active", renewsAt })
      .where(eq(subscriptionsTable.ownerId, ownerId))
      .returning();

    // Create a real invoice row (no payment captured — payments not connected).
    const number = await nextInvoiceNumber(ownerId);
    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        ownerId,
        number,
        description: `${plan.name} plan — monthly`,
        amountCents: plan.priceCents ?? 0,
        currency: "usd",
        status: plan.priceCents === 0 ? "paid" : "due",
      })
      .returning();

    res.json({ subscription: subscriptionJson(updated!), invoice: invoiceJson(invoice!) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to change plan.") });
  }
});

// ── Invoices ──────────────────────────────────────────────────────────────────
function invoiceJson(row: typeof invoicesTable.$inferSelect) {
  return {
    id: row.id,
    number: row.number,
    description: row.description,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
  };
}

async function nextInvoiceNumber(ownerId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoicesTable)
    .where(eq(invoicesTable.ownerId, ownerId));
  const seq = (count ?? 0) + 1;
  return `PV-${year}-${String(seq).padStart(4, "0")}`;
}

router.get("/billing/invoices", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.ownerId, ownerId))
      .orderBy(sql`${invoicesTable.issuedAt} desc`);
    res.json({ invoices: rows.map(invoiceJson) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load invoices.") });
  }
});

// ── GET /billing/invoices/:id/download → standalone HTML invoice ───────────────
router.get("/billing/invoices/:id/download", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.id, req.params.id!), eq(invoicesTable.ownerId, ownerId)));
    if (!invoice) return void res.status(404).json({ message: "Invoice not found." });
    const [profile] = await db.select().from(billingProfilesTable).where(eq(billingProfilesTable.ownerId, ownerId));
    const html = renderInvoiceHtml(invoice, profile);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.number}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to download invoice.") });
  }
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function renderInvoiceHtml(inv: typeof invoicesTable.$inferSelect, profile: typeof billingProfilesTable.$inferSelect | undefined): string {
  const issued = inv.issuedAt.toISOString().slice(0, 10);
  const to = [profile?.companyName, profile?.billingEmail, profile?.taxId ? `Tax ID: ${profile.taxId}` : "", profile?.address]
    .filter(Boolean)
    .map(v => `<div>${escapeHtml(String(v))}</div>`)
    .join("") || "<div>No billing profile on file.</div>";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${escapeHtml(inv.number)}</title>
<style>
  body{font-family:-apple-system,Inter,Segoe UI,sans-serif;color:#111;margin:0;padding:48px;background:#fff}
  .wrap{max-width:720px;margin:0 auto}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:24px}
  .brand{font-size:24px;font-weight:700;letter-spacing:-0.02em}
  .muted{color:#666;font-size:13px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:32px 0 8px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{text-align:left;padding:12px 0;border-bottom:1px solid #eee;font-size:14px}
  td.amt,th.amt{text-align:right}
  .total{font-size:20px;font-weight:700;text-align:right;margin-top:24px}
  .status{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;text-transform:uppercase}
  .status.paid{background:#dcfce7;color:#166534}.status.due{background:#fef3c7;color:#92400e}.status.void{background:#f3f4f6;color:#6b7280}
  .footer{margin-top:48px;color:#888;font-size:12px}
</style></head>
<body><div class="wrap">
  <div class="head">
    <div><div class="brand">Payvora</div><div class="muted">Invoice</div></div>
    <div style="text-align:right"><div><strong>${escapeHtml(inv.number)}</strong></div><div class="muted">Issued ${escapeHtml(issued)}</div>
    <div style="margin-top:8px"><span class="status ${escapeHtml(inv.status)}">${escapeHtml(inv.status)}</span></div></div>
  </div>
  <h2>Billed to</h2>${to}
  <h2>Details</h2>
  <table><thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
  <tbody><tr><td>${escapeHtml(inv.description)}</td><td class="amt">${formatMoney(inv.amountCents, inv.currency)}</td></tr></tbody></table>
  <div class="total">Total ${formatMoney(inv.amountCents, inv.currency)}</div>
  <div class="footer">Payments are not connected during preview — this invoice records a plan change and does not represent a captured payment.</div>
</div></body></html>`;
}

// ── GET /billing/usage → aggregate usage + real counts + plan limits ───────────
router.get("/billing/usage", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const sub = await ensureSubscription(ownerId);
    const plan = planById(sub.plan) ?? PLANS[0];

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // Metered usage events this month, summed per metric.
    const eventRows = await db
      .select({ metric: usageEventsTable.metric, total: sql<number>`coalesce(sum(${usageEventsTable.quantity}),0)::int` })
      .from(usageEventsTable)
      .where(and(eq(usageEventsTable.ownerId, ownerId), gte(usageEventsTable.createdAt, monthStart)))
      .groupBy(usageEventsTable.metric);
    const events: Record<string, number> = {};
    for (const r of eventRows) events[r.metric] = r.total;

    // Real counts from existing tables (source of truth, not just events).
    const [{ docCount }] = await db
      .select({ docCount: sql<number>`count(*)::int` })
      .from(documentsTable)
      .where(eq(documentsTable.ownerId, ownerId));
    const [{ genCount }] = await db
      .select({ genCount: sql<number>`count(*)::int` })
      .from(generationsTable)
      .where(eq(generationsTable.ownerId, ownerId));
    const [{ ttsSeconds }] = await db
      .select({ ttsSeconds: sql<number>`coalesce(sum(${generationsTable.durationSeconds}),0)::int` })
      .from(generationsTable)
      .where(and(eq(generationsTable.ownerId, ownerId), eq(generationsTable.status, "completed")));

    const usage = {
      ai_tokens: events["ai_tokens"] ?? 0,
      documents: docCount ?? 0,
      storage_bytes: events["storage_bytes"] ?? 0,
      agent_runs: events["agent_runs"] ?? 0,
      tts_seconds: Math.max(ttsSeconds ?? 0, events["tts_seconds"] ?? 0),
      api_requests: events["api_requests"] ?? 0,
      generations: genCount ?? 0,
    };

    res.json({
      plan: plan.id,
      planName: plan.name,
      limits: plan.limits,
      usage,
      periodStart: monthStart.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load usage.") });
  }
});

// ── Billing profile GET/PUT ────────────────────────────────────────────────────
function profileJson(row: typeof billingProfilesTable.$inferSelect | undefined) {
  return {
    companyName: row?.companyName ?? "",
    billingEmail: row?.billingEmail ?? "",
    taxId: row?.taxId ?? "",
    address: row?.address ?? "",
  };
}

router.get("/billing/profile", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const [row] = await db.select().from(billingProfilesTable).where(eq(billingProfilesTable.ownerId, ownerId));
    res.json({ profile: profileJson(row) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load billing profile.") });
  }
});

router.put("/billing/profile", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 500) : null);
  try {
    const values = {
      ownerId,
      companyName: clean(body.companyName),
      billingEmail: clean(body.billingEmail),
      taxId: clean(body.taxId),
      address: clean(body.address),
    };
    const [row] = await db
      .insert(billingProfilesTable)
      .values(values)
      .onConflictDoUpdate({
        target: billingProfilesTable.ownerId,
        set: { companyName: values.companyName, billingEmail: values.billingEmail, taxId: values.taxId, address: values.address },
      })
      .returning();
    res.json({ profile: profileJson(row) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save billing profile.") });
  }
});

export default router;
