import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredVoice = {
  id: string;
  ownerId: string;
  name: string;
  audioPath: string;
  referenceText?: string;
  createdAt: string;
};

export interface VoiceStorage {
  saveVoice(input: { ownerId: string; name: string; audio: Buffer; referenceText?: string }): Promise<StoredVoice>;
  listVoices(ownerId: string): Promise<StoredVoice[]>;
  getVoice(ownerId: string, voiceId: string): Promise<StoredVoice>;
  deleteVoice(ownerId: string, voiceId: string): Promise<void>;
  readAudio(voice: StoredVoice): Promise<Buffer>;
  saveGeneration(ownerId: string, generationId: string, audio: Buffer): Promise<string>;
  readGeneration(ownerId: string, generationId: string): Promise<Buffer>;
}

export class LocalVoiceStorage implements VoiceStorage {
  private readonly root: string;
  private readonly metadataPath: string;

  constructor(root = process.env["VOICE_STORAGE_DIR"] ?? path.resolve(process.cwd(), ".data", "voices")) {
    this.root = path.resolve(root);
    this.metadataPath = path.join(this.root, "voices.json");
  }

  private async readMetadata(): Promise<StoredVoice[]> {
    try {
      return JSON.parse(await readFile(this.metadataPath, "utf8")) as StoredVoice[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeMetadata(voices: StoredVoice[]): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.metadataPath, JSON.stringify(voices, null, 2), "utf8");
  }

  async saveVoice(input: { ownerId: string; name: string; audio: Buffer; referenceText?: string }): Promise<StoredVoice> {
    const id = randomUUID();
    const relativePath = path.join("references", `${id}.wav`);
    const absolutePath = path.join(this.root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.audio, { mode: 0o600 });
    const voice: StoredVoice = { id, ownerId: input.ownerId, name: input.name, audioPath: relativePath, referenceText: input.referenceText, createdAt: new Date().toISOString() };
    const voices = await this.readMetadata();
    voices.push(voice);
    await this.writeMetadata(voices);
    return voice;
  }

  async listVoices(ownerId: string): Promise<StoredVoice[]> {
    return (await this.readMetadata()).filter(voice => voice.ownerId === ownerId);
  }

  async getVoice(ownerId: string, voiceId: string): Promise<StoredVoice> {
    const voice = (await this.readMetadata()).find(item => item.id === voiceId && item.ownerId === ownerId);
    if (!voice) throw new Error("Voice not found.");
    return voice;
  }

  async deleteVoice(ownerId: string, voiceId: string): Promise<void> {
    const voices = await this.readMetadata();
    const voice = voices.find(item => item.id === voiceId && item.ownerId === ownerId);
    if (!voice) throw new Error("Voice not found.");
    const filtered = voices.filter(item => item.id !== voiceId);
    await this.writeMetadata(filtered);
  }

  async readAudio(voice: StoredVoice): Promise<Buffer> {
    const resolved = path.resolve(this.root, voice.audioPath);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid stored audio path.");
    return readFile(resolved);
  }

  async saveGeneration(ownerId: string, generationId: string, audio: Buffer): Promise<string> {
    const relativePath = path.join("generations", ownerId, `${generationId}.wav`);
    const resolved = path.resolve(this.root, relativePath);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid generation path.");
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, audio, { mode: 0o600 });
    return relativePath;
  }

  async readGeneration(ownerId: string, generationId: string): Promise<Buffer> {
    const relativePath = path.join("generations", ownerId, `${generationId}.wav`);
    const resolved = path.resolve(this.root, relativePath);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid generation path.");
    return readFile(resolved);
  }
}