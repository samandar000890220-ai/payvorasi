import { Router, type IRouter } from "express";
import { db, templatesTable, templateFavoritesTable, documentsTable, BUILTIN_OWNER, type Template } from "@workspace/db";
import { sessionOwner } from "../lib/session";
import { recordUsage } from "../lib/usage";
import { and, eq, or, sql } from "drizzle-orm";

const router: IRouter = Router();

const wordCount = (html: string): number => {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
};

type Seed = { name: string; category: string; description: string; content: string };
const BUILTIN_SEEDS: Seed[] = [
  { name: "Professional Invoice", category: "finance", description: "Clean itemized invoice with totals and payment terms.",
    content: `<h1>Invoice</h1><p><strong>Invoice #:</strong> INV-0001<br><strong>Date:</strong> [Date]<br><strong>Due:</strong> [Due date]</p><h2>Bill To</h2><p>[Client name]<br>[Client address]</p><h2>Line Items</h2><ul><li>[Description] — [Qty] × [Rate] = [Amount]</li><li>[Description] — [Qty] × [Rate] = [Amount]</li></ul><p><strong>Subtotal:</strong> [Subtotal]<br><strong>Tax:</strong> [Tax]<br><strong>Total Due:</strong> [Total]</p><h2>Payment Terms</h2><p>Payment due within 30 days. Bank transfer to [account details].</p>` },
  { name: "Business Proposal", category: "business", description: "Persuasive proposal covering problem, solution, pricing.",
    content: `<h1>Business Proposal</h1><h2>Executive Summary</h2><p>[One-paragraph overview of the opportunity and your recommendation.]</p><h2>The Problem</h2><p>[Describe the challenge the client faces.]</p><h2>Proposed Solution</h2><ul><li>[Deliverable 1]</li><li>[Deliverable 2]</li><li>[Deliverable 3]</li></ul><h2>Timeline</h2><p>[Phase 1 — weeks 1-2, Phase 2 — weeks 3-6…]</p><h2>Investment</h2><p>[Pricing breakdown and terms.]</p><h2>Next Steps</h2><p>[Call to action.]</p>` },
  { name: "Quarterly Financial Report", category: "finance", description: "Structured report of revenue, expenses and KPIs.",
    content: `<h1>Quarterly Financial Report</h1><p><strong>Period:</strong> [Q# YYYY]</p><h2>Highlights</h2><ul><li>Revenue: [amount] ([+/-]% QoQ)</li><li>Gross margin: [%]</li><li>Net income: [amount]</li></ul><h2>Revenue Breakdown</h2><p>[By product / segment / region.]</p><h2>Operating Expenses</h2><p>[COGS, sales & marketing, G&A, R&D.]</p><h2>Cash Position</h2><p>[Cash on hand, burn rate, runway.]</p><h2>Outlook</h2><p>[Guidance and key risks for next quarter.]</p>` },
  { name: "Meeting Notes", category: "document", description: "Agenda, decisions and action items template.",
    content: `<h1>Meeting Notes</h1><p><strong>Date:</strong> [Date] · <strong>Attendees:</strong> [Names]</p><h2>Agenda</h2><ul><li>[Topic 1]</li><li>[Topic 2]</li></ul><h2>Discussion & Decisions</h2><ul><li>[Decision or key point]</li></ul><h2>Action Items</h2><ul><li>[ ] [Owner] — [Task] — due [date]</li></ul><h2>Next Meeting</h2><p>[Date / focus.]</p>` },
  { name: "Statement of Work (SOW)", category: "business", description: "Scope, deliverables, milestones and acceptance criteria.",
    content: `<h1>Statement of Work</h1><h2>Parties</h2><p>[Provider] and [Client], effective [date].</p><h2>Scope of Work</h2><p>[Detailed description of services.]</p><h2>Deliverables</h2><ul><li>[Deliverable — acceptance criteria]</li></ul><h2>Milestones & Schedule</h2><ul><li>[Milestone — date]</li></ul><h2>Fees & Payment</h2><p>[Total fee, schedule, invoicing terms.]</p><h2>Assumptions</h2><p>[Dependencies and out-of-scope items.]</p>` },
  { name: "Annual Budget Plan", category: "finance", description: "Category-based budget with targets and variance notes.",
    content: `<h1>Annual Budget Plan</h1><p><strong>Fiscal year:</strong> [YYYY]</p><h2>Income</h2><ul><li>[Source] — [Projected amount]</li></ul><h2>Fixed Costs</h2><ul><li>Rent — [amount]</li><li>Salaries — [amount]</li><li>Software — [amount]</li></ul><h2>Variable Costs</h2><ul><li>Marketing — [amount]</li><li>Travel — [amount]</li></ul><h2>Summary</h2><p><strong>Total income:</strong> [amount]<br><strong>Total expenses:</strong> [amount]<br><strong>Net:</strong> [amount]</p>` },
  { name: "Email Marketing Campaign", category: "business", description: "Multi-touch campaign brief with subject lines and CTAs.",
    content: `<h1>Email Campaign Brief</h1><h2>Objective</h2><p>[Goal and target audience.]</p><h2>Sequence</h2><ul><li><strong>Email 1 — Intro:</strong> Subject: [line]. Body: [hook + value]. CTA: [action].</li><li><strong>Email 2 — Value:</strong> Subject: [line]. Body: [proof/story]. CTA: [action].</li><li><strong>Email 3 — Offer:</strong> Subject: [line]. Body: [offer + urgency]. CTA: [action].</li></ul><h2>Success Metrics</h2><p>Open rate, click rate, conversions.</p>` },
  { name: "AI Content Workflow Prompt", category: "workflow", description: "Reusable prompt chain for generating on-brand content.",
    content: `<h1>AI Content Workflow</h1><h2>Step 1 — Brief</h2><p>Prompt: "Act as a [role]. The audience is [audience]. Goal: [goal]. Tone: [tone]."</p><h2>Step 2 — Draft</h2><p>Prompt: "Using the brief above, draft [format] of about [length] covering [points]."</p><h2>Step 3 — Refine</h2><p>Prompt: "Tighten the draft, remove filler, add a strong opening hook and clear CTA."</p><h2>Step 4 — QA</h2><p>Prompt: "Check facts, ensure brand voice, and flag any unsupported claims."</p>` },
  { name: "Product Requirements Doc (PRD)", category: "document", description: "Problem, users, requirements and success metrics.",
    content: `<h1>Product Requirements Document</h1><h2>Problem Statement</h2><p>[What problem, for whom, and why now.]</p><h2>Goals & Non-Goals</h2><ul><li>Goal: [outcome]</li><li>Non-goal: [explicitly out of scope]</li></ul><h2>User Stories</h2><ul><li>As a [user], I want [capability] so that [benefit].</li></ul><h2>Requirements</h2><ul><li>[Functional requirement]</li></ul><h2>Success Metrics</h2><p>[Measurable targets.]</p>` },
  { name: "Weekly Status Update", category: "workflow", description: "Progress, blockers and next-week priorities.",
    content: `<h1>Weekly Status Update</h1><p><strong>Week of:</strong> [Date]</p><h2>Shipped This Week</h2><ul><li>[Item]</li></ul><h2>In Progress</h2><ul><li>[Item — % complete]</li></ul><h2>Blockers</h2><ul><li>[Blocker — who can help]</li></ul><h2>Next Week</h2><ul><li>[Priority]</li></ul>` },
  { name: "Client Onboarding Checklist", category: "workflow", description: "Step-by-step onboarding tasks for new clients.",
    content: `<h1>Client Onboarding</h1><h2>Kickoff</h2><ul><li>[ ] Welcome email sent</li><li>[ ] Kickoff call scheduled</li><li>[ ] Contract & invoice signed</li></ul><h2>Setup</h2><ul><li>[ ] Accounts & access provisioned</li><li>[ ] Brand assets collected</li><li>[ ] Goals & KPIs agreed</li></ul><h2>First Deliverable</h2><ul><li>[ ] Draft delivered</li><li>[ ] Feedback incorporated</li></ul>` },
  { name: "Cash Flow Forecast", category: "finance", description: "Rolling forecast of inflows, outflows and net position.",
    content: `<h1>Cash Flow Forecast</h1><p><strong>Horizon:</strong> [# months]</p><h2>Opening Balance</h2><p>[Amount]</p><h2>Expected Inflows</h2><ul><li>[Customer / source] — [amount] — [month]</li></ul><h2>Expected Outflows</h2><ul><li>Payroll — [amount] — [month]</li><li>Suppliers — [amount] — [month]</li></ul><h2>Net & Closing Balance</h2><p><strong>Net movement:</strong> [amount]<br><strong>Closing balance:</strong> [amount]</p>` },
];

let seedPromise: Promise<void> | null = null;
async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: templatesTable.id }).from(templatesTable).where(eq(templatesTable.ownerId, BUILTIN_OWNER)).limit(1);
      if (existing.length === 0) {
        await db.insert(templatesTable).values(BUILTIN_SEEDS.map(s => ({ ownerId: BUILTIN_OWNER, name: s.name, category: s.category, description: s.description, content: s.content })));
      }
    })().catch(err => { seedPromise = null; throw err; });
  }
  return seedPromise;
}

const tmplJson = (t: Template, favorite: boolean, builtin: boolean) => ({
  id: t.id, name: t.name, category: t.category, description: t.description, content: t.content,
  useCount: t.useCount, favorite, builtin, createdAt: t.createdAt.toISOString(),
});

// ── List / browse ─────────────────────────────────────────────────────────────
router.get("/templates", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  await ensureSeeded();
  const rows = await db.select().from(templatesTable)
    .where(or(eq(templatesTable.ownerId, BUILTIN_OWNER), eq(templatesTable.ownerId, ownerId)));
  const favRows = await db.select().from(templateFavoritesTable).where(eq(templateFavoritesTable.ownerId, ownerId));
  const favSet = new Set(favRows.map(f => f.templateId));
  const category = String(req.query.category ?? "").trim().toLowerCase();
  const search = String(req.query.search ?? "").trim().toLowerCase();
  let out = rows.map(t => tmplJson(t, favSet.has(t.id), t.ownerId === BUILTIN_OWNER));
  if (category && category !== "all") out = out.filter(t => t.category === category);
  if (search) out = out.filter(t => t.name.toLowerCase().includes(search) || t.description.toLowerCase().includes(search));
  out.sort((a, b) => (b.favorite === a.favorite ? b.useCount - a.useCount : a.favorite ? -1 : 1));
  res.json({ templates: out });
});

// ── Create own template ───────────────────────────────────────────────────────
router.post("/templates", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { name?: unknown; category?: unknown; description?: unknown; content?: unknown };
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 120) return void res.status(422).json({ message: "Template name must be 1–120 characters." });
  const allowed = ["business", "finance", "document", "workflow"];
  const category = allowed.includes(String(body.category)) ? String(body.category) : "business";
  const description = String(body.description ?? "").trim().slice(0, 300);
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return void res.status(422).json({ message: "Template content cannot be empty." });
  const [row] = await db.insert(templatesTable).values({ ownerId, name, category, description, content }).returning();
  res.status(201).json(tmplJson(row, false, false));
});

router.delete("/templates/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.delete(templatesTable)
    .where(and(eq(templatesTable.id, req.params.id), eq(templatesTable.ownerId, ownerId))).returning();
  if (!row) return void res.status(404).json({ message: "Template not found or is a built-in template." });
  await db.delete(templateFavoritesTable).where(and(eq(templateFavoritesTable.templateId, req.params.id), eq(templateFavoritesTable.ownerId, ownerId)));
  res.status(204).end();
});

// ── Favorite / unfavorite ───────────────────────────────────────────────────
router.post("/templates/:id/favorite", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [tmpl] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, req.params.id), or(eq(templatesTable.ownerId, BUILTIN_OWNER), eq(templatesTable.ownerId, ownerId))));
  if (!tmpl) return void res.status(404).json({ message: "Template not found." });
  const favorite = Boolean((req.body as { favorite?: unknown })?.favorite);
  const existing = await db.select().from(templateFavoritesTable)
    .where(and(eq(templateFavoritesTable.templateId, req.params.id), eq(templateFavoritesTable.ownerId, ownerId)));
  if (favorite && existing.length === 0) await db.insert(templateFavoritesTable).values({ ownerId, templateId: req.params.id });
  if (!favorite && existing.length > 0) await db.delete(templateFavoritesTable).where(and(eq(templateFavoritesTable.templateId, req.params.id), eq(templateFavoritesTable.ownerId, ownerId)));
  res.json({ favorite });
});

// ── Use template → create real document ───────────────────────────────────────
router.post("/templates/:id/use", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [tmpl] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, req.params.id), or(eq(templatesTable.ownerId, BUILTIN_OWNER), eq(templatesTable.ownerId, ownerId))));
  if (!tmpl) return void res.status(404).json({ message: "Template not found." });
  const [doc] = await db.insert(documentsTable).values({
    ownerId, title: tmpl.name, content: tmpl.content, wordCount: wordCount(tmpl.content),
  }).returning();
  await db.update(templatesTable).set({ useCount: sql`${templatesTable.useCount} + 1` }).where(eq(templatesTable.id, tmpl.id));
  await recordUsage(ownerId, "documents", 1);
  res.status(201).json({ documentId: doc.id, title: doc.title });
});

export default router;
