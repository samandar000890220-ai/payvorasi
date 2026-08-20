export type TagType = "emotion" | "vocal_event" | "pacing" | "emphasis" | "ambient";

export type TagDefinition = {
  name: string;
  type: TagType;
  aliases: string[];
  description: string;
  strategy: "worker_control" | "pause" | "time_stretch" | "worker_vocal_event";
  parameters?: Record<string, number | string>;
  spoken: boolean;
  separateAudioEvent: boolean;
  postProcess: boolean;
  /** False when the current F5-TTS backend genuinely cannot honor this tag. Kept in the registry so a future backend can re-enable it. */
  supported: boolean;
  unsupportedReason?: string;
};

const EMOTION_UNSUPPORTED = "The current F5-TTS backend does not support emotion control — F5-TTS mimics the emotion of the reference recording only.";
const VOCAL_EVENT_UNSUPPORTED = "The current F5-TTS backend cannot generate non-speech vocal events.";

const definitions: TagDefinition[] = [
  ...[
    ["angry", "forceful and tense delivery"],
    ["sad", "lower-energy, subdued delivery"],
    ["embarrassed", "hesitant, self-conscious delivery"],
    ["excited", "energetic delivery"],
    ["serious", "measured, direct delivery"],
    ["soft", "gentle, lower-energy delivery"],
    ["quietly", "quiet delivery"],
    ["whisper", "whisper-style delivery"],
    ["whispering", "whisper-style delivery"],
    ["breathy", "breathy delivery"],
  ].map(([name, description]) => ({
    name,
    type: "emotion" as const,
    aliases: [],
    description,
    strategy: "worker_control" as const,
    spoken: false,
    separateAudioEvent: false,
    postProcess: false,
    supported: false,
    unsupportedReason: EMOTION_UNSUPPORTED,
  })),
  ...[
    ["laughing", "audible laugh"],
    ["laugh", "audible laugh"],
    ["giggling", "light giggle"],
    ["giggle", "light giggle"],
    ["chuckling", "quiet chuckle"],
    ["chuckle", "quiet chuckle"],
    ["snicker", "snicker"],
    ["clear throat", "clear throat"],
    ["sigh", "sigh"],
    ["sighing", "sigh"],
    ["heavy sigh", "heavy sigh"],
    ["gasp", "gasp"],
    ["cough", "cough"],
    ["groan", "groan"],
    ["groaning", "groan"],
    ["moaning", "moan"],
    ["sobbing", "sob"],
    ["crying loudly", "loud cry"],
    ["panting", "panting"],
  ].map(([name, description]) => ({
    name,
    type: "vocal_event" as const,
    aliases: [],
    description,
    strategy: "worker_vocal_event" as const,
    spoken: false,
    separateAudioEvent: true,
    postProcess: false,
    supported: false,
    unsupportedReason: VOCAL_EVENT_UNSUPPORTED,
  })),
  { name: "pause", type: "pacing", aliases: [], description: "brief silence", strategy: "pause", parameters: { seconds: 0.35 }, spoken: false, separateAudioEvent: false, postProcess: true, supported: true },
  { name: "short pause", type: "pacing", aliases: [], description: "short silence", strategy: "pause", parameters: { seconds: 0.65 }, spoken: false, separateAudioEvent: false, postProcess: true, supported: true },
  { name: "long pause", type: "pacing", aliases: [], description: "long silence", strategy: "pause", parameters: { seconds: 1.25 }, spoken: false, separateAudioEvent: false, postProcess: true, supported: true },
  { name: "slowly", type: "pacing", aliases: [], description: "slower speaking rate", strategy: "time_stretch", parameters: { speed: 0.78 }, spoken: false, separateAudioEvent: false, postProcess: true, supported: true },
  { name: "fast", type: "pacing", aliases: [], description: "faster speaking rate", strategy: "time_stretch", parameters: { speed: 1.22 }, spoken: false, separateAudioEvent: false, postProcess: true, supported: true },
  { name: "emphasis", type: "emphasis", aliases: [], description: "emphasized next speech segment", strategy: "worker_control", parameters: { energy: 1.18 }, spoken: false, separateAudioEvent: false, postProcess: false, supported: true },
  ...[
    ["crowd laughing", "crowd laughter"],
    ["background laughter", "background laughter"],
    ["audience laughing", "audience laughter"],
  ].map(([name, description]) => ({
    name,
    type: "ambient" as const,
    aliases: [],
    description,
    strategy: "worker_vocal_event" as const,
    spoken: false,
    separateAudioEvent: true,
    postProcess: false,
    supported: false,
    unsupportedReason: VOCAL_EVENT_UNSUPPORTED,
  })),
];

export const TAG_REGISTRY = definitions;

const byName = new Map<string, TagDefinition>();
for (const definition of TAG_REGISTRY) {
  byName.set(definition.name, definition);
  for (const alias of definition.aliases) byName.set(alias, definition);
}

export function findTag(rawName: string): TagDefinition | undefined {
  return byName.get(rawName.trim().toLowerCase().replace(/\s+/g, " "));
}

export function listTags(): TagDefinition[] {
  return TAG_REGISTRY;
}