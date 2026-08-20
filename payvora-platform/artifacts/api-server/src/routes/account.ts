import { Router, type IRouter } from "express";
import { db, userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sessionOwner, errorMessage } from "../lib/session";

const router: IRouter = Router();

/**
 * Settings persist in userSettingsTable.settings (jsonb). Keys are NAMESPACED so
 * the voice domain's settings are never clobbered — we only read/merge under
 * profile, notifications, ai, workspace, language, appearance.
 */
type Settings = Record<string, unknown>;

async function readSettings(ownerId: string): Promise<Settings> {
  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.ownerId, ownerId));
  return (row?.settings as Settings | undefined) ?? {};
}

async function mergeSettings(ownerId: string, patch: Settings): Promise<Settings> {
  const current = await readSettings(ownerId);
  const next = { ...current, ...patch };
  await db
    .insert(userSettingsTable)
    .values({ ownerId, settings: next })
    .onConflictDoUpdate({ target: userSettingsTable.ownerId, set: { settings: next } });
  return next;
}

const asStr = (v: unknown, max = 200): string | undefined => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const asBool = (v: unknown): boolean => v === true;

const DEFAULT_AI_MODELS = ["gpt-5.6-terra"];
const RESPONSE_STYLES = ["brief", "balanced", "detailed"] as const;
const LANGUAGES = [
  { code: "en", name: "English", active: true },
  { code: "es", name: "Español", active: false },
  { code: "fr", name: "Français", active: false },
  { code: "de", name: "Deutsch", active: false },
  { code: "pt", name: "Português", active: false },
  { code: "ja", name: "日本語", active: false },
];
const DATE_FORMATS = ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "D MMM YYYY"];
const CURRENCIES = ["usd", "eur", "gbp", "jpy"];

// ── GET /account/settings → everything the settings page needs ─────────────────
router.get("/account/settings", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const s = await readSettings(ownerId);
    res.json({
      profile: (s.profile as Settings) ?? {},
      workspace: (s.workspace as Settings) ?? {},
      ai: (s.ai as Settings) ?? {},
      notifications: (s.notifications as Settings) ?? {},
      appearance: (s.appearance as Settings) ?? {},
      language: (s.language as Settings) ?? {},
      options: {
        aiModels: DEFAULT_AI_MODELS,
        responseStyles: RESPONSE_STYLES,
        languages: LANGUAGES,
        dateFormats: DATE_FORMATS,
        currencies: CURRENCIES,
      },
    });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load settings.") });
  }
});

// ── PUT /account/profile ─────────────────────────────────────────────────────
router.put("/account/profile", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Settings;
  try {
    const profile = { displayName: asStr(body.displayName, 80) ?? "", email: asStr(body.email, 120) ?? "" };
    const next = await mergeSettings(ownerId, { profile });
    res.json({ profile: next.profile });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save profile.") });
  }
});

// ── PUT /account/workspace ────────────────────────────────────────────────────
router.put("/account/workspace", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Settings;
  try {
    const workspace = { name: asStr(body.name, 80) ?? "", defaultStudio: asStr(body.defaultStudio, 40) ?? "" };
    const next = await mergeSettings(ownerId, { workspace });
    res.json({ workspace: next.workspace });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save workspace.") });
  }
});

// ── AI settings ────────────────────────────────────────────────────────────────
router.put("/account/ai", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Settings;
  try {
    const model = asStr(body.defaultModel, 60) ?? DEFAULT_AI_MODELS[0]!;
    const styleRaw = asStr(body.responseStyle, 20) ?? "balanced";
    const responseStyle = (RESPONSE_STYLES as readonly string[]).includes(styleRaw) ? styleRaw : "balanced";
    const ai = { defaultModel: model, responseStyle };
    const next = await mergeSettings(ownerId, { ai });
    res.json({ ai: next.ai });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save AI settings.") });
  }
});

// ── GET /account/ai-settings → stored preferences (consumable by aiChat) ────────
router.get("/account/ai-settings", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const s = await readSettings(ownerId);
    const ai = (s.ai as Settings) ?? {};
    res.json({ defaultModel: ai.defaultModel ?? DEFAULT_AI_MODELS[0], responseStyle: ai.responseStyle ?? "balanced" });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to load AI settings.") });
  }
});

// ── Notifications ────────────────────────────────────────────────────────────
router.put("/account/notifications", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Settings;
  try {
    const notifications = {
      emailNotifications: asBool(body.emailNotifications),
      productUpdates: asBool(body.productUpdates),
      alerts: asBool(body.alerts),
    };
    const next = await mergeSettings(ownerId, { notifications });
    res.json({ notifications: next.notifications });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save notifications.") });
  }
});

// ── Appearance (also persisted client-side via useTheme; mirrored here) ────────
router.put("/account/appearance", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Settings;
  try {
    const modeRaw = asStr(body.mode, 10) ?? "light";
    const mode = ["light", "dark", "system"].includes(modeRaw) ? modeRaw : "light";
    const appearance = { mode, accent: asStr(body.accent, 20) ?? "" };
    const next = await mergeSettings(ownerId, { appearance });
    res.json({ appearance: next.appearance });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save appearance.") });
  }
});

// ── Language + regional settings ─────────────────────────────────────────────
router.put("/account/language", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = (req.body ?? {}) as Settings;
  try {
    const langRaw = asStr(body.language, 6) ?? "en";
    // Only English is genuinely active; other languages are stored preferences only.
    const language = LANGUAGES.some(l => l.code === langRaw) ? langRaw : "en";
    const dateFmtRaw = asStr(body.dateFormat, 20) ?? "YYYY-MM-DD";
    const dateFormat = DATE_FORMATS.includes(dateFmtRaw) ? dateFmtRaw : "YYYY-MM-DD";
    const currencyRaw = (asStr(body.currency, 4) ?? "usd").toLowerCase();
    const currency = CURRENCIES.includes(currencyRaw) ? currencyRaw : "usd";
    const next = await mergeSettings(ownerId, { language: { language, dateFormat, currency } });
    res.json({ language: next.language });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error, "Failed to save language settings.") });
  }
});

export default router;
