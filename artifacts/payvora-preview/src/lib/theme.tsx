import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export const ACCENTS = ["#3C8CFF", "#7C3AED", "#f97316", "#16a34a", "#dc2626", "#0d9488"] as const;

type ThemeState = {
  mode: ThemeMode;
  accent: string;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored("payvora-theme-mode", "light"));
  // Accent is only persisted when the user explicitly picks one in Settings,
  // so a stored value (including orange) is deliberate and must be preserved.
  const [accent, setAccentState] = useState<string>(() => readStored("payvora-theme-accent", ACCENTS[0]));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const resolved: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.setProperty("--pv-brand", accent);
  }, [resolved, accent]);

  const value = useMemo<ThemeState>(
    () => ({
      mode,
      accent,
      resolved,
      setMode: m => {
        setModeState(m);
        window.localStorage.setItem("payvora-theme-mode", JSON.stringify(m));
      },
      setAccent: a => {
        setAccentState(a);
        window.localStorage.setItem("payvora-theme-accent", JSON.stringify(a));
      },
    }),
    [mode, accent, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
