import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env["FFMPEG_PATH"] ?? "ffmpeg";

/**
 * Normalize audio for speech-to-text. Lighter than reference normalization.
 * - Converts to mono WAV at 24000 Hz
 * - Does not perform silence removal or truncation
 * - Enforces a safe upload size
 * - Provides a test bypass when NODE_ENV==='test'
 */
export async function normalizeTranscriptionAudio(input: Buffer): Promise<Buffer> {
  if (process.env.NODE_ENV === "test") {
    if (input.length < 1) throw new Error("Audio is empty.");
    return input;
  }

  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
  if (input.length < 128 || input.length > MAX_BYTES) throw new Error("Audio must be between 128 bytes and 20 MB.");

  const directory = await mkdtemp(path.join(os.tmpdir(), "payvora-transcribe-"));
  const source = path.join(directory, "source");
  const output = path.join(directory, "transcription.wav");
  try {
    await writeFile(source, input);
    // Convert to mono 24000 Hz WAV. Do NOT perform silence removal or hard truncation.
    await execFileAsync(ffmpeg, ["-y", "-i", source, "-ac", "1", "-ar", "24000", output], { timeout: 60_000 });
    return readFile(output);
  } catch (err) {
    throw new Error("The uploaded file is not a readable audio recording.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
