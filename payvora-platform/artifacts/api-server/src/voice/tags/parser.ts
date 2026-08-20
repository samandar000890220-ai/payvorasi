import { findTag, listTags, type TagDefinition } from "./registry";

export type SpeechControls = {
  emotion?: string;
  speed?: number;
  energy?: number;
  pitch?: number;
};

export type SpeechEvent =
  | { type: "speech"; text: string; controls: SpeechControls }
  | { type: "pause"; seconds: number }
  | { type: "vocal_event"; event: string; description: string };

export type ParsedSpeech = {
  events: SpeechEvent[];
  tags: Array<{ raw: string; normalized: string; definition: TagDefinition }>;
};

const TAG_PATTERN = /\[([^\]]+)\]/g;

export class TagParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagParseError";
  }
}

export function parseTaggedText(input: string): ParsedSpeech {
  if (input.trim().length === 0) throw new TagParseError("Text is required.");
  const events: SpeechEvent[] = [];
  const tags: ParsedSpeech["tags"] = [];
  let cursor = 0;
  let controls: SpeechControls = {};

  const pushSpeech = (text: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized) events.push({ type: "speech", text: normalized, controls: { ...controls } });
  };

  for (const match of input.matchAll(TAG_PATTERN)) {
    const full = match[0];
    const index = match.index ?? 0;
    pushSpeech(input.slice(cursor, index));
    const rawName = match[1].trim();
    const definition = findTag(rawName);
    if (!definition) {
      const available = listTags().filter(tag => tag.supported).map(tag => `[${tag.name}]`).join(", ");
      throw new TagParseError(`Unsupported tag [${rawName}]. Choose one of ${available}.`);
    }
    if (!definition.supported) {
      throw new TagParseError(`[${definition.name}] is not available: ${definition.unsupportedReason ?? "not supported by the current F5-TTS backend."}`);
    }
    tags.push({ raw: full, normalized: definition.name, definition });

    if (definition.type === "emotion") controls = { ...controls, emotion: definition.name };
    if (definition.type === "emphasis") controls = { ...controls, energy: Number(definition.parameters?.energy ?? 1.15) };
    if (definition.name === "slowly" || definition.name === "fast") {
      controls = { ...controls, speed: Number(definition.parameters?.speed) };
    }
    if (definition.type === "vocal_event" || definition.type === "ambient") {
      events.push({ type: "vocal_event", event: definition.name, description: definition.description });
      controls = {};
    }
    if (definition.strategy === "pause") {
      events.push({ type: "pause", seconds: Number(definition.parameters?.seconds ?? 0.5) });
      controls = {};
    }
    cursor = index + full.length;
  }

  pushSpeech(input.slice(cursor));
  const unmatchedOpen = input.indexOf("[", cursor);
  if (unmatchedOpen >= 0) throw new TagParseError("Malformed tag: missing closing ']'.");
  if (events.length === 0) throw new TagParseError("Text must contain speech or a supported tag.");
  return { events, tags };
}