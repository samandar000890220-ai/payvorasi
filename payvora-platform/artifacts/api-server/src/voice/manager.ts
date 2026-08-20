import { concatenateAudio, probeDurationSeconds, timeStretchAudio } from "./audio";
import { F5TtsClient } from "./f5tts/client";
import { parseTaggedText, TagParseError } from "./tags/parser";
import type { DbVoiceStorage } from "./dbStorage";
import type { Generation } from "@workspace/db";

export type GenerationStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

type QueueEntry = {
  id: string;
  ownerId: string;
  voiceId: string;
  text: string;
  settings: Record<string, unknown>;
};

/**
 * Serial generation queue. Persistent record state lives in PostgreSQL
 * (generations table); this class only manages in-flight processing.
 * A record only becomes "completed" after F5-TTS actually produced audio.
 */
export class GenerationManager {
  private readonly queue: QueueEntry[] = [];
  private readonly cancelled = new Set<string>();
  private running = false;

  constructor(private readonly storage: DbVoiceStorage, private readonly f5tts = new F5TtsClient()) {}

  async create(ownerId: string, voiceId: string, text: string, settings?: Record<string, unknown>, options?: { kind?: "generation" | "preview"; title?: string }): Promise<Generation> {
    parseTaggedText(text); // validate tags up-front (throws TagParseError)
    if (settings && "emotion" in settings) {
      throw new TagParseError("Speaking style (emotion) is not available: the current F5-TTS backend mimics the emotion of the reference recording only.");
    }
    const voice = await this.storage.getVoiceRow(ownerId, voiceId);
    const title = options?.title?.trim() || text.replace(/\[[^\]]*\]/g, "").trim().slice(0, 60) || "Untitled generation";
    const record = await this.storage.createGenerationRecord({
      ownerId, voiceId, voiceName: voice.name, title, text,
      settings: settings ?? {}, kind: options?.kind ?? "generation",
    });
    await this.storage.updateVoice(ownerId, voiceId, { lastUsedAt: new Date() });
    this.queue.push({ id: record.id, ownerId, voiceId, text, settings: settings ?? {} });
    void this.runNext();
    return record;
  }

  async cancel(ownerId: string, id: string): Promise<Generation> {
    const record = await this.storage.getGenerationRecord(ownerId, id);
    if (record.status === "queued" || record.status === "processing") {
      this.cancelled.add(id);
      const index = this.queue.findIndex(entry => entry.id === id);
      if (index >= 0) this.queue.splice(index, 1);
      if (record.status === "queued") {
        await this.storage.updateGenerationRecord(id, { status: "cancelled", error: "Cancelled by user." });
      }
      // If processing, the run loop notices the flag between segments.
    }
    return this.storage.getGenerationRecord(ownerId, id);
  }

  private async runNext(): Promise<void> {
    if (this.running) return;
    const entry = this.queue.shift();
    if (!entry) return;
    this.running = true;
    try {
      if (this.cancelled.has(entry.id)) return;
      await this.storage.updateGenerationRecord(entry.id, { status: "processing", progress: 5 });
      const voice = await this.storage.getVoice(entry.ownerId, entry.voiceId);
      const referenceAudio = await this.storage.readAudio(voice);
      const requested = entry.settings;
      const controls = {
        ...(typeof requested.speed === "number" ? { speed: requested.speed } : {}),
        ...(typeof requested.pitch === "number" ? { pitch: requested.pitch } : {}),
        ...(typeof requested.energy === "number" ? { energy: requested.energy } : {}),
        ...(typeof requested.emotion === "string" ? { emotion: requested.emotion } : {}),
      };
      const parsed = parseTaggedText(entry.text);
      const events = parsed.events;
      const parts: Buffer[] = [];
      const pauses: number[] = [];
      for (let index = 0; index < events.length; index += 1) {
        if (this.cancelled.has(entry.id)) {
          await this.storage.updateGenerationRecord(entry.id, { status: "cancelled", error: "Cancelled by user." });
          return;
        }
        const event = events[index];
        if (event.type === "pause") {
          if (parts.length > 0) pauses[parts.length - 1] = event.seconds;
          continue;
        }
        let audio: Buffer;
        if (event.type === "speech") {
          audio = await this.f5tts.generateSpeech({ text: event.text, referenceAudio, referenceText: voice.referenceText, controls: { ...event.controls, ...controls } });
          if (event.controls.speed) audio = await timeStretchAudio(audio, event.controls.speed);
        } else {
          audio = await this.f5tts.generateVocalEvent({ event: event.event, referenceAudio, referenceText: voice.referenceText, controls: {} });
        }
        parts.push(audio);
        pauses.push(0);
        await this.storage.updateGenerationRecord(entry.id, { progress: Math.min(90, 5 + Math.round(((index + 1) / events.length) * 85)) });
      }
      if (this.cancelled.has(entry.id)) {
        await this.storage.updateGenerationRecord(entry.id, { status: "cancelled", error: "Cancelled by user." });
        return;
      }
      const finalAudio = await concatenateAudio(parts, pauses);
      const audioPath = await this.storage.saveGeneration(entry.ownerId, entry.id, finalAudio);
      const durationSeconds = await probeDurationSeconds(finalAudio);
      await this.storage.updateGenerationRecord(entry.id, {
        status: "completed", progress: 100, audioPath,
        durationSeconds: durationSeconds ?? null, completedAt: new Date(),
      });
    } catch (error) {
      await this.storage.updateGenerationRecord(entry.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Voice generation failed.",
      }).catch(() => undefined);
    } finally {
      this.cancelled.delete(entry.id);
      this.running = false;
      void this.runNext();
    }
  }
}
