import { Router, type IRouter } from "express";
import { db, userSettingsTable } from "@workspace/db";
import { sessionOwner, errorMessage } from "../lib/session";
import { eq } from "drizzle-orm";
import { validateAndNormalizeReference, transcodeAudio, isSupportedFormat, isSupportedSampleRate, formatMime } from "../voice/audio";
import { normalizeTranscriptionAudio } from "../voice/transcription";
import { GenerationManager } from "../voice/manager";
import { listTags } from "../voice/tags/registry";
import { parseTaggedText, TagParseError } from "../voice/tags/parser";
import { F5TtsClient } from "../voice/f5tts/client";
import { DbVoiceStorage } from "../voice/dbStorage";
import Busboy from 'busboy';

const router: IRouter = Router();
const storage = new DbVoiceStorage();
const manager = new GenerationManager(storage);
const voiceJson = (v: { id: string; name: string; description: string | null; category: string; favorite: boolean; referenceText: string | null; avatarUrl?: string | null; lastUsedAt: Date | null; createdAt: Date }) => ({
  id: v.id, name: v.name, description: v.description, category: v.category, favorite: v.favorite,
  referenceText: v.referenceText, avatarUrl: v.avatarUrl ?? null, lastUsedAt: v.lastUsedAt?.toISOString() ?? null, createdAt: v.createdAt.toISOString(),
});

const generationJson = (g: { id: string; voiceId: string | null; voiceName: string; title: string; text: string; settings: Record<string, unknown>; status: string; progress: number; durationSeconds: number | null; error: string | null; favorite: boolean; createdAt: Date; completedAt: Date | null }) => ({
  id: g.id, voiceId: g.voiceId, voiceName: g.voiceName, title: g.title, text: g.text, settings: g.settings,
  status: g.status, progress: g.progress, audioAvailable: g.status === "completed",
  durationSeconds: g.durationSeconds, error: g.error, favorite: g.favorite,
  createdAt: g.createdAt.toISOString(), completedAt: g.completedAt?.toISOString() ?? null,
});

// ── Capabilities: honest declaration of what this F5-TTS deployment supports ──
router.get("/voice/capabilities", async (_req, res) => {
  const client = new F5TtsClient();
  const health = await client.health();
  res.json({
    engine: "f5-tts",
    configured: client.configured,
    reachable: health.reachable,
    healthDetail: health.detail,
    supportedControls: ["speed", "pitch", "energy"],
    unsupportedControls: [
      { name: "stability", reason: "F5-TTS does not expose a stability parameter." },
      { name: "similarity", reason: "F5-TTS voice similarity is fixed by the reference recording." },
      { name: "emotion", reason: "The current F5-TTS backend does not support emotion control — it mimics the emotion of the reference recording only." },
      { name: "vocal_events", reason: "The current F5-TTS backend cannot generate non-speech vocal events such as [laugh] or [sigh]." },
    ],
    pauses: { supported: true, mechanism: "[pause:seconds] tags" },
    outputFormats: ["wav", "mp3"],
    sampleRates: [16000, 22050, 24000, 44100, 48000],
    maxTextLength: 5000,
  });
});

router.get("/voice/tags", (_req, res) => res.json({ tags: listTags() }));

// ── Voices ────────────────────────────────────────────────────────────────────
router.post("/voices", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const name = String(req.header("x-voice-name") ?? "").trim();
  if (!name || name.length > 80) return void res.status(400).json({ message: "x-voice-name is required and must be 80 characters or fewer." });
  if (!Buffer.isBuffer(req.body)) return void res.status(415).json({ message: "Send reference audio bytes with an audio content type." });
  try {
    const audio = await validateAndNormalizeReference(req.body);
    const voice = await storage.saveVoice({ ownerId, name, audio, referenceText: req.header("x-reference-text")?.trim() || undefined });
    const row = await storage.getVoiceRow(ownerId, voice.id);
    res.status(201).json(voiceJson(row));
  } catch (error) {
    res.status(400).json({ message: errorMessage(error, "Reference audio upload failed.") });
  }
});

router.get("/voices", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  res.json({ voices: (await storage.listVoiceRows(ownerId)).map(voiceJson) });
});

router.patch("/voices/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { name?: unknown; description?: unknown; favorite?: unknown; category?: unknown };
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 80) return void res.status(422).json({ message: "Voice name must be 1–80 characters." });
    patch.name = name;
  }
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 300) || null;
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;
  if (typeof body.category === "string" && body.category.trim()) patch.category = body.category.trim().slice(0, 40);
  if (Object.keys(patch).length === 0) return void res.status(422).json({ message: "Nothing to update." });
  try {
    res.json(voiceJson(await storage.updateVoice(ownerId, req.params.id, patch)));
  } catch {
    res.status(404).json({ message: "Voice not found." });
  }
});

router.post("/voices/:id/duplicate", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    res.status(201).json(voiceJson(await storage.duplicateVoice(ownerId, req.params.id)));
  } catch {
    res.status(404).json({ message: "Voice not found." });
  }
});

router.get("/voices/:id/audio", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const voice = await storage.getVoice(ownerId, req.params.id);
    res.type("audio/wav").send(await storage.readAudio(voice));
  } catch {
    res.status(404).json({ message: "Voice not found." });
  }
});

router.delete("/voices/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    await storage.deleteVoice(ownerId, req.params.id);
    res.status(204).end();
  } catch {
    res.status(404).json({ message: "Voice not found." });
  }
});

// ── Generation ────────────────────────────────────────────────────────────────
router.post("/voices/:id/generate", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { text?: unknown; settings?: Record<string, unknown>; title?: unknown };
  if (typeof body?.text !== "string" || !body.text.trim()) return void res.status(422).json({ message: "Text is required." });
  if (body.text.length > 5000) return void res.status(422).json({ message: "Text must be 5,000 characters or fewer." });
  try {
    const record = await manager.create(ownerId, req.params.id, body.text, body.settings, { title: typeof body.title === "string" ? body.title : undefined });
    res.status(202).json({ generationId: record.id, status: record.status, progress: record.progress });
  } catch (error) {
    const status = error instanceof TagParseError ? 422 : 400;
    res.status(status).json({ message: errorMessage(error, "Generation request failed.") });
  }
});

router.post("/voices/:id/preview", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { text?: unknown };
  const text = typeof body?.text === "string" && body.text.trim() ? body.text.trim().slice(0, 300) : "Hi there! This is a quick preview of how this voice sounds.";
  try {
    const record = await manager.create(ownerId, req.params.id, text, undefined, { kind: "preview", title: "Voice preview" });
    res.status(202).json({ generationId: record.id, status: record.status, progress: record.progress });
  } catch (error) {
    res.status(422).json({ message: errorMessage(error, "Preview request failed.") });
  }
});

router.get("/generation/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    res.json(generationJson(await storage.getGenerationRecord(ownerId, req.params.id)));
  } catch {
    res.status(404).json({ message: "Generation not found." });
  }
});

router.post("/generation/:id/cancel", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    res.json(generationJson(await manager.cancel(ownerId, req.params.id)));
  } catch {
    res.status(404).json({ message: "Generation not found." });
  }
});

router.get("/generation/:id/audio", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    const record = await storage.getGenerationRecord(ownerId, req.params.id);
    if (record.status !== "completed") return void res.status(409).json({ message: "Generation is not complete." });
    const format = String(req.query.format ?? "wav").toLowerCase();
    if (!isSupportedFormat(format)) return void res.status(422).json({ message: "Supported formats: wav, mp3." });
    const rateRaw = req.query.sampleRate ? Number(req.query.sampleRate) : undefined;
    if (rateRaw !== undefined && !isSupportedSampleRate(rateRaw)) return void res.status(422).json({ message: "Supported sample rates: 16000, 22050, 24000, 44100, 48000." });
    const wav = await storage.readGeneration(ownerId, record.id);
    const audio = await transcodeAudio(wav, format, rateRaw);
    if (req.query.download) {
      const base = record.title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "generation";
      res.setHeader("Content-Disposition", `attachment; filename="${base}.${format}"`);
    }
    res.type(formatMime(format)).send(audio);
  } catch {
    res.status(404).json({ message: "Generated audio not found." });
  }
});

// ── History ───────────────────────────────────────────────────────────────────
router.get("/history", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  res.json({ items: (await storage.listGenerationRecords(ownerId)).map(generationJson) });
});

router.patch("/history/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { favorite?: unknown; title?: unknown };
  const patch: Record<string, unknown> = {};
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 120);
  if (Object.keys(patch).length === 0) return void res.status(422).json({ message: "Nothing to update." });
  try {
    await storage.getGenerationRecord(ownerId, req.params.id);
    await storage.updateGenerationRecord(req.params.id, patch, ownerId);
    res.json(generationJson(await storage.getGenerationRecord(ownerId, req.params.id)));
  } catch {
    res.status(404).json({ message: "History item not found." });
  }
});

router.delete("/history/:id", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  try {
    await storage.deleteGenerationRecord(ownerId, req.params.id);
    res.status(204).end();
  } catch {
    res.status(404).json({ message: "History item not found." });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get("/settings", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.ownerId, ownerId));
  res.json({ settings: row?.settings ?? {} });
});

router.put("/settings", async (req, res) => {
  const ownerId = sessionOwner(req, res);
  const body = req.body as { settings?: unknown };
  if (typeof body?.settings !== "object" || body.settings === null || Array.isArray(body.settings)) {
    return void res.status(422).json({ message: "settings must be an object." });
  }
  const settings = body.settings as Record<string, unknown>;
  await db.insert(userSettingsTable)
    .values({ ownerId, settings })
    .onConflictDoUpdate({ target: userSettingsTable.ownerId, set: { settings } });
  res.json({ settings });
});

// ── Misc ──────────────────────────────────────────────────────────────────────
router.post("/audio/transcribe", async (req, res) => {
  if (!Buffer.isBuffer(req.body)) return void res.status(415).json({ message: "Send audio bytes with an audio content type." });
  try {
    const audio = await validateAndNormalizeReference(req.body);
    const text = await new F5TtsClient().transcribe(audio);
    res.json({ text });
  } catch (error) {
    res.status(503).json({ message: errorMessage(error, "Transcription is unavailable.") });
  }
});

// New route supporting multipart/form-data as well as raw audio uploads.

router.post('/voice/transcribe', async (req, res) => {
  const contentType = String(req.headers['content-type'] ?? '');
  try {
    let buffer: Buffer | null = null;
    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

    if (contentType.startsWith('multipart/form-data')) {
      // Parse multipart with Busboy and collect the "file" field into memory
      const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_BYTES } });
      let finished = false;
      let aborted = false;
      buffer = null;
      await new Promise<void>((resolve, reject) => {
        bb.on('file', (fieldname: string, stream: import('stream').Readable & { truncated?: boolean }, info) => {
          const chunks: Buffer[] = [];
          let total = 0;
          stream.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_BYTES) {
              aborted = true;
              stream.resume();
              bb.emit('error', new Error('File too large'));
              return;
            }
            chunks.push(Buffer.from(chunk));
          });
          stream.on('end', () => {
            buffer = Buffer.concat(chunks);
          });
        });
                bb.on('error', (err: Error) => { aborted = true; reject(err); });
        bb.on('finish', () => { finished = true; resolve(); });
        req.pipe(bb);
      });
      if (aborted) return void res.status(413).json({ message: 'Uploaded file is too large.' });
    } else if (contentType.startsWith('audio/') || req.is('application/octet-stream')) {
      if (!Buffer.isBuffer(req.body)) return void res.status(415).json({ message: 'Send raw audio bytes with an audio content type.' });
      buffer = req.body as Buffer;
      if (buffer.length > 20 * 1024 * 1024) return void res.status(413).json({ message: 'Uploaded file is too large.' });
    } else {
      return void res.status(415).json({ message: 'Unsupported content type. Send multipart/form-data with field "file" or raw audio bytes.' });
    }

    if (!buffer || buffer.length === 0) return void res.status(400).json({ message: 'No audio file provided.' });

    // Normalize/validate for transcription (STT) and transcribe using provider
    const audio = await normalizeTranscriptionAudio(buffer);
    const client = new F5TtsClient();
    const transcript = await client.transcribe(audio);
    res.json({ transcript });
  } catch (error) {
    if ((error as any)?.message?.includes('File too large') || (error as any)?.code === 'LIMIT_FILE_SIZE') {
      return void res.status(413).json({ message: 'Uploaded file is too large.' });
    }
    // Map known worker-unavailable errors to 503
    if (error instanceof Error && error.name === 'F5TtsUnavailableError') return void res.status(503).json({ message: error.message });
    console.error('Transcription error', error instanceof Error ? error.message : error);
    res.status(502).json({ message: errorMessage(error, 'Transcription failed.') });
  }
});

router.post("/voice/parse", (req, res) => {
  const body = req.body as { text?: unknown };
  if (typeof body?.text !== "string") return void res.status(400).json({ message: "text is required." });
  try {
    res.json(parseTaggedText(body.text));
  } catch (error) {
    res.status(422).json({ message: errorMessage(error, "Tag parsing failed.") });
  }
});

export default router;
