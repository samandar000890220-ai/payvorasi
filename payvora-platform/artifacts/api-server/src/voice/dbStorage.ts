import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { db, voicesTable, generationsTable, type Voice, type Generation } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import type { StoredVoice, VoiceStorage } from "./storage";

/**
 * PostgreSQL-backed voice storage. Metadata is the DB; audio bytes stay on disk.
 * Implements the existing VoiceStorage interface so GenerationManager is unchanged,
 * and adds richer voice/generation persistence used by the routes.
 */
export class DbVoiceStorage implements VoiceStorage {
  private readonly root: string;

  constructor(root = process.env["VOICE_STORAGE_DIR"] ?? path.resolve(process.cwd(), ".data", "voices")) {
    this.root = path.resolve(root);
  }

  private resolveSafe(relativePath: string): string {
    const resolved = path.resolve(this.root, relativePath);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid stored audio path.");
    return resolved;
  }

  private toStored(voice: Voice): StoredVoice {
    return {
      id: voice.id,
      ownerId: voice.ownerId,
      name: voice.name,
      audioPath: voice.audioPath,
      referenceText: voice.referenceText ?? undefined,
      createdAt: voice.createdAt.toISOString(),
    };
  }

  // ── VoiceStorage interface ────────────────────────────────────────────────
  async saveVoice(input: { ownerId: string; name: string; audio: Buffer; referenceText?: string }): Promise<StoredVoice> {
    const [row] = await db.insert(voicesTable).values({
      ownerId: input.ownerId,
      name: input.name,
      referenceText: input.referenceText ?? null,
      audioPath: "pending",
    }).returning();
    const relativePath = path.join("references", `${row.id}.wav`);
    const absolutePath = this.resolveSafe(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.audio, { mode: 0o600 });
    const [updated] = await db.update(voicesTable).set({ audioPath: relativePath }).where(eq(voicesTable.id, row.id)).returning();
    return this.toStored(updated);
  }

  async listVoices(ownerId: string): Promise<StoredVoice[]> {
    return (await this.listVoiceRows(ownerId)).map(v => this.toStored(v));
  }

  async listVoiceRows(ownerId: string): Promise<Voice[]> {
    return db.select().from(voicesTable).where(eq(voicesTable.ownerId, ownerId)).orderBy(desc(voicesTable.createdAt));
  }

  async getVoiceRow(ownerId: string, voiceId: string): Promise<Voice> {
    const [voice] = await db.select().from(voicesTable).where(and(eq(voicesTable.id, voiceId), eq(voicesTable.ownerId, ownerId)));
    if (!voice) throw new Error("Voice not found.");
    return voice;
  }

  async getVoice(ownerId: string, voiceId: string): Promise<StoredVoice> {
    return this.toStored(await this.getVoiceRow(ownerId, voiceId));
  }

  async updateVoice(ownerId: string, voiceId: string, patch: Partial<Pick<Voice, "name" | "description" | "favorite" | "referenceText" | "category" | "lastUsedAt">>): Promise<Voice> {
    await this.getVoiceRow(ownerId, voiceId);
    const [updated] = await db.update(voicesTable).set(patch).where(and(eq(voicesTable.id, voiceId), eq(voicesTable.ownerId, ownerId))).returning();
    return updated;
  }

  async duplicateVoice(ownerId: string, voiceId: string): Promise<Voice> {
    const original = await this.getVoiceRow(ownerId, voiceId);
    const audio = await readFile(this.resolveSafe(original.audioPath));
    const [row] = await db.insert(voicesTable).values({
      ownerId,
      name: `${original.name} (copy)`,
      description: original.description,
      category: original.category,
      referenceText: original.referenceText,
      audioPath: "pending",
    }).returning();
    const relativePath = path.join("references", `${row.id}.wav`);
    const absolutePath = this.resolveSafe(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, audio, { mode: 0o600 });
    const [updated] = await db.update(voicesTable).set({ audioPath: relativePath }).where(eq(voicesTable.id, row.id)).returning();
    return updated;
  }

  async deleteVoice(ownerId: string, voiceId: string): Promise<void> {
    const voice = await this.getVoiceRow(ownerId, voiceId);
    await db.delete(voicesTable).where(and(eq(voicesTable.id, voiceId), eq(voicesTable.ownerId, ownerId)));
    await rm(this.resolveSafe(voice.audioPath), { force: true });
  }

  async readAudio(voice: StoredVoice): Promise<Buffer> {
    return readFile(this.resolveSafe(voice.audioPath));
  }

  async saveGeneration(ownerId: string, generationId: string, audio: Buffer): Promise<string> {
    const relativePath = path.join("generations", ownerId, `${generationId}.wav`);
    const resolved = this.resolveSafe(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, audio, { mode: 0o600 });
    return relativePath;
  }

  async readGeneration(ownerId: string, generationId: string): Promise<Buffer> {
    const [row] = await db.select().from(generationsTable).where(and(eq(generationsTable.id, generationId), eq(generationsTable.ownerId, ownerId)));
    if (!row?.audioPath) throw new Error("Generated audio not found.");
    return readFile(this.resolveSafe(row.audioPath));
  }

  // ── Generation records ────────────────────────────────────────────────────
  async createGenerationRecord(input: { ownerId: string; voiceId: string; voiceName: string; title: string; text: string; settings: Record<string, unknown>; kind: "generation" | "preview" }): Promise<Generation> {
    const [row] = await db.insert(generationsTable).values({ ...input, status: "queued", progress: 0 }).returning();
    return row;
  }

  async updateGenerationRecord(id: string, patch: Partial<Pick<Generation, "status" | "progress" | "audioPath" | "durationSeconds" | "error" | "completedAt" | "title" | "favorite">>, ownerId?: string): Promise<void> {
    const where = ownerId ? and(eq(generationsTable.id, id), eq(generationsTable.ownerId, ownerId)) : eq(generationsTable.id, id);
    await db.update(generationsTable).set(patch).where(where);
  }

  async getGenerationRecord(ownerId: string, id: string): Promise<Generation> {
    const [row] = await db.select().from(generationsTable).where(and(eq(generationsTable.id, id), eq(generationsTable.ownerId, ownerId)));
    if (!row) throw new Error("Generation not found.");
    return row;
  }

  async listGenerationRecords(ownerId: string): Promise<Generation[]> {
    return db.select().from(generationsTable)
      .where(and(eq(generationsTable.ownerId, ownerId), eq(generationsTable.kind, "generation")))
      .orderBy(desc(generationsTable.createdAt));
  }

  async deleteGenerationRecord(ownerId: string, id: string): Promise<void> {
    const row = await this.getGenerationRecord(ownerId, id);
    await db.delete(generationsTable).where(eq(generationsTable.id, id));
    if (row.audioPath) await rm(this.resolveSafe(row.audioPath), { force: true });
  }
}
