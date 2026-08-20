import { useEffect } from "react";

/**
 * Global keyboard shortcuts registry + hook.
 *
 * The App shell wires `useGlobalShortcuts({ onNewChat, onNavigate })` once; the
 * Shortcuts page reads {@link SHORTCUTS} to render the reference list. Shortcuts
 * marked `global: true` are the ones this hook actually binds at the document
 * level. Others are documented as page-scoped (handled inside their own page).
 */
export type ShortcutGroup = "Navigation" | "AI" | "Search" | "Editor";

export type Shortcut = {
  id: string;
  /** Human-readable key hint, e.g. "⌘ K" or "G then D". */
  keys: string;
  description: string;
  group: ShortcutGroup;
  /** True when this hook binds it at the document level (globally active). */
  global: boolean;
};

// "mod" resolves to ⌘ on macOS, Ctrl elsewhere — decided at render time.
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD_LABEL = isMac ? "⌘" : "Ctrl";

export const SHORTCUTS: Shortcut[] = [
  { id: "new-chat", keys: `${MOD_LABEL} K`, description: "Start a new AI chat", group: "AI", global: true },
  { id: "go-integrations", keys: "G then I", description: "Go to Integrations", group: "Navigation", global: true },
  { id: "focus-search", keys: "/", description: "Focus the search input (page-scoped)", group: "Search", global: false },
  { id: "send-message", keys: `${MOD_LABEL} ↵`, description: "Send the AI message (AI Chat)", group: "AI", global: false },
];

export type ShortcutHandlers = {
  onNewChat: () => void;
  /** Navigate to a registry page by its label (e.g. "Integrations"). */
  onNavigate: (label: string) => void;
};

// "G then X" chord map → page label.
const CHORD_MAP: Record<string, string> = {
  i: "Integrations",
};

const isEditableTarget = (el: EventTarget | null): boolean => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
};

/**
 * Binds the globally-active shortcuts to document keydown. Safe to mount once.
 * Ignores keystrokes while typing in inputs/textareas (except the ⌘K new-chat
 * combo, which is intentionally global).
 */
export function useGlobalShortcuts({ onNewChat, onNavigate }: ShortcutHandlers): void {
  useEffect(() => {
    let chordActive = false;
    let chordTimer: ReturnType<typeof setTimeout> | undefined;

    const clearChord = () => {
      chordActive = false;
      if (chordTimer) clearTimeout(chordTimer);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ⌘/Ctrl + K → new chat (works even inside inputs)
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        clearChord();
        onNewChat();
        return;
      }

      if (isEditableTarget(e.target) || mod || e.altKey) {
        clearChord();
        return;
      }

      // Chord: "g" then a page letter
      if (chordActive) {
        const label = CHORD_MAP[e.key.toLowerCase()];
        clearChord();
        if (label) {
          e.preventDefault();
          onNavigate(label);
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        chordActive = true;
        chordTimer = setTimeout(clearChord, 1200);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearChord();
    };
  }, [onNewChat, onNavigate]);
}
