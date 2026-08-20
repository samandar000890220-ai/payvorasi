import type { SpeechControls } from "../tags/parser";
import type { VoiceProvider } from "../provider";

export type F5TtsConfig = {
  serviceUrl: string;
  model: string;
  device: string;
  computeType: string;
  token?: string;
};

export type F5TtsRequest = {
  text: string;
  referenceAudio: Buffer;
  referenceText?: string;
  controls: SpeechControls;
};

export class F5TtsUnavailableError extends Error {
  constructor(message = "F5-TTS worker is not configured. Set F5_TTS_SERVICE_URL to an accessible GPU worker.") {
    super(message);
    this.name = "F5TtsUnavailableError";
  }
}

export class F5TtsClient implements VoiceProvider {
  private readonly config: F5TtsConfig;

  constructor(config: F5TtsConfig = {
    serviceUrl: process.env["F5_TTS_SERVICE_URL"] ?? "",
    model: process.env["F5_TTS_MODEL"] ?? "F5TTS_v1_Base",
    device: process.env["F5_TTS_DEVICE"] ?? "auto",
    computeType: process.env["F5_TTS_COMPUTE_TYPE"] ?? "auto",
    token: process.env["F5_TTS_SERVICE_TOKEN"],
  }) {
    this.config = { ...config, serviceUrl: config.serviceUrl.replace(/\/+$/, "") };
  }

  get configured(): boolean {
    return Boolean(this.config.serviceUrl);
  }

  /** Probe the worker's /v1/health endpoint. Returns reachability without throwing. */
  async health(timeoutMs = 4000): Promise<{ reachable: boolean; detail: string }> {
    if (!this.configured) return { reachable: false, detail: "F5_TTS_SERVICE_URL is not set." };
    const headers: Record<string, string> = {};
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    try {
      const response = await fetch(`${this.config.serviceUrl}/v1/health`, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return { reachable: false, detail: `Worker responded HTTP ${response.status} on /v1/health.` };
      return { reachable: true, detail: "Worker is reachable." };
    } catch (error) {
      return { reachable: false, detail: `Worker is not reachable: ${error instanceof Error ? error.message : "network error"}.` };
    }
  }

  private async request(path: string, form: FormData): Promise<Buffer> {
    if (!this.configured) throw new F5TtsUnavailableError();
    const headers: Record<string, string> = {};
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    const response = await fetch(`${this.config.serviceUrl}${path}`, { method: "POST", body: form, headers });
    if (!response.ok) throw new Error(`F5-TTS worker returned HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }

  async generateSpeech(request: F5TtsRequest): Promise<Buffer> {
    const form = new FormData();
    form.set("text", request.text);
    form.set("reference_text", request.referenceText ?? "");
    form.set("model", this.config.model);
    form.set("device", this.config.device);
    form.set("compute_type", this.config.computeType);
    form.set("controls", JSON.stringify(request.controls));
    form.set("response_format", "wav");
    form.set("reference_audio", new Blob([new Uint8Array(request.referenceAudio)], { type: "audio/wav" }), "reference.wav");
    return this.request("/v1/speech", form);
  }

  async generateVocalEvent(request: Omit<F5TtsRequest, "text"> & { event: string }): Promise<Buffer> {
    const form = new FormData();
    form.set("event", request.event);
    form.set("reference_text", request.referenceText ?? "");
    form.set("model", this.config.model);
    form.set("device", this.config.device);
    form.set("compute_type", this.config.computeType);
    form.set("response_format", "wav");
    form.set("reference_audio", new Blob([new Uint8Array(request.referenceAudio)], { type: "audio/wav" }), "reference.wav");
    return this.request("/v1/vocal-event", form);
  }

  async transcribe(audio: Buffer): Promise<string> {
    const form = new FormData();
    form.set("audio", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "reference.wav");
    if (!this.configured) throw new F5TtsUnavailableError();
    const headers: Record<string, string> = {};
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    const response = await fetch(`${this.config.serviceUrl}/v1/transcribe`, { method: "POST", body: form, headers });
    if (!response.ok) throw new Error(`Transcription worker returned HTTP ${response.status}.`);
    const payload = (await response.json()) as { text?: string };
    if (!payload.text) throw new Error("Transcription worker returned no text.");
    return payload.text;
  }
}