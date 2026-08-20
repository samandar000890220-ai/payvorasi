export type VoiceProviderHealth = { reachable: boolean; detail: string };

export interface VoiceProvider {
  /** Whether the provider is configured and can be used */
  configured: boolean;
  /** Probe health; optional but useful for capability endpoints */
  health?(): Promise<VoiceProviderHealth>;
  /** Transcribe normalized audio buffer and return the transcript text */
  transcribe(audio: Buffer): Promise<string>;
}
