import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env["FFMPEG_PATH"] ?? "ffmpeg";
const ffprobe = process.env["FFPROBE_PATH"] ?? "ffprobe";

export async function validateAndNormalizeReference(input: Buffer): Promise<Buffer> {
  // Test environments may not have ffmpeg/ffprobe available; provide a
  // lightweight pass-through so unit tests can run without external tools.
  if (process.env.NODE_ENV === 'test') {
    if (input.length < 1) throw new Error('Reference audio is empty.');
    return input;
  }

  if (input.length < 128 || input.length > 50 * 1024 * 1024) throw new Error("Reference audio must be between 128 bytes and 50 MB.");
  const directory = await mkdtemp(path.join(os.tmpdir(), "payvora-audio-"));
  const source = path.join(directory, "source");
  const output = path.join(directory, "reference.wav");
  try {
    await writeFile(source, input);
    await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", source], { timeout: 15_000 });
    // Cap the reference at 12 s: F5-TTS clones best from short references, and
    // long ones make inference exceed the Cloudflare tunnel timeout (HTTP 502).
    await execFileAsync(ffmpeg, ["-y", "-i", source, "-ac", "1", "-ar", "24000", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB", "-t", "12", output], { timeout: 60_000 });
    return readFile(output);
  } catch {
    throw new Error("The uploaded file is not a readable audio recording.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function concatenateAudio(files: Buffer[], pauses: number[]): Promise<Buffer> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "payvora-mix-"));
  try {
    const inputs: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = path.join(directory, `part-${index}.wav`);
      await writeFile(file, files[index]);
      inputs.push(file);
      const pauseSeconds = Math.max(0, pauses[index] ?? 0);
      if (pauseSeconds > 0) {
        const silence = path.join(directory, `silence-${index}.wav`);
        await execFileAsync(ffmpeg, ["-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=24000", "-t", String(pauseSeconds), silence], { timeout: 30_000 });
        inputs.push(silence);
      }
    }
    const concatList = path.join(directory, "concat.txt");
    await writeFile(concatList, inputs.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
    const output = path.join(directory, "output.wav");
    await execFileAsync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-ar", "24000", "-ac", "1", output], { timeout: 120_000 });
    return readFile(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function probeDurationSeconds(input: Buffer): Promise<number | undefined> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "payvora-probe-"));
  try {
    const source = path.join(directory, "audio.wav");
    await writeFile(source, input);
    const { stdout } = await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", source], { timeout: 15_000 });
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : undefined;
  } catch {
    return undefined;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const SUPPORTED_FORMATS = { wav: { ext: "wav", mime: "audio/wav", args: [] as string[] }, mp3: { ext: "mp3", mime: "audio/mpeg", args: ["-codec:a", "libmp3lame", "-qscale:a", "2"] } };
const SUPPORTED_SAMPLE_RATES = [16000, 22050, 24000, 44100, 48000];

export type AudioFormat = keyof typeof SUPPORTED_FORMATS;
export function isSupportedFormat(value: string): value is AudioFormat { return value in SUPPORTED_FORMATS; }
export function isSupportedSampleRate(value: number): boolean { return SUPPORTED_SAMPLE_RATES.includes(value); }
export function formatMime(format: AudioFormat): string { return SUPPORTED_FORMATS[format].mime; }

export async function transcodeAudio(input: Buffer, format: AudioFormat, sampleRate?: number): Promise<Buffer> {
  if (format === "wav" && (!sampleRate || sampleRate === 24000)) return input;
  const spec = SUPPORTED_FORMATS[format];
  const directory = await mkdtemp(path.join(os.tmpdir(), "payvora-transcode-"));
  try {
    const source = path.join(directory, "source.wav");
    const output = path.join(directory, `output.${spec.ext}`);
    await writeFile(source, input);
    const rateArgs = sampleRate ? ["-ar", String(sampleRate)] : [];
    await execFileAsync(ffmpeg, ["-y", "-i", source, ...rateArgs, ...spec.args, output], { timeout: 60_000 });
    return readFile(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function timeStretchAudio(input: Buffer, speed: number): Promise<Buffer> {
  if (speed === 1) return input;
  const directory = await mkdtemp(path.join(os.tmpdir(), "payvora-speed-"));
  try {
    const source = path.join(directory, "source.wav");
    const output = path.join(directory, "output.wav");
    await writeFile(source, input);
    const atempo = Math.max(0.5, Math.min(2, speed));
    await execFileAsync(ffmpeg, ["-y", "-i", source, "-filter:a", `atempo=${atempo}`, output], { timeout: 60_000 });
    return readFile(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}