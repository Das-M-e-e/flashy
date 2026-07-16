import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Theme = "light" | "dark";
export type ThemeMode = Theme | "system";

interface ThemeContextValue {
  /** Aktueller Modus (inkl. "system"); während einer Vorschau im Einstellungsdialog der Entwurfswert. */
  mode: ThemeMode;
  /** Aufgelöstes Design für die Darstellung -- "system" wird zur echten OS-Präferenz aufgelöst. */
  theme: Theme;
  /** Zuletzt gespeicherter Modus -- Referenz für Änderungserkennung und "Abbrechen". */
  savedMode: ThemeMode;
  /** Nur Vorschau: ändert Anzeige/State, ohne zu speichern (für den Einstellungsdialog). */
  preview: (mode: ThemeMode) => void;
  /** Übernimmt den aktuellen Entwurf dauerhaft (localStorage + Server). */
  commit: () => void;
  /** Verwirft den Entwurf, stellt den zuletzt gespeicherten Modus wieder her. */
  revert: () => void;
  /** Schnellzugriff im Header: wechselt sofort zwischen hell/dunkel und speichert direkt. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "flashy-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return systemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [savedMode, setSavedMode] = useState<ThemeMode>(mode);
  const [systemPref, setSystemPref] = useState<Theme>(systemTheme);

  // Solange "system" aktiv ist, live auf OS-Präferenzänderungen reagieren.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemPref(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme: Theme = mode === "system" ? systemPref : mode;

  // Server ist die Quelle der Wahrheit über Sitzungen/Geräte hinweg (localStorage
  // dient nur als sofort verfügbarer Cache fürs erste Rendern ohne Flackern).
  useEffect(() => {
    api
      .generalConfig()
      .then((cfg) => {
        if (cfg.theme === "light" || cfg.theme === "dark" || cfg.theme === "system") {
          setMode(cfg.theme);
          setSavedMode(cfg.theme);
        }
      })
      .catch(() => {});
  }, []);

  // Nur die Darstellung folgt sofort dem (ggf. noch nicht gespeicherten) Entwurf.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function commit(): void {
    localStorage.setItem(STORAGE_KEY, mode);
    setSavedMode(mode);
    api.generalSaveConfig({ theme: mode }).catch(() => {});
  }

  function revert(): void {
    setMode(savedMode);
  }

  function toggle(): void {
    const next: Theme = theme === "light" ? "dark" : "light";
    setMode(next);
    setSavedMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    api.generalSaveConfig({ theme: next }).catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ mode, theme, savedMode, preview: setMode, commit, revert, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
