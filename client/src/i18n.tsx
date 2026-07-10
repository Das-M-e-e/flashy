import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "de" | "en";

type Vars = Record<string, string | number>;

const STORAGE_KEY = "flashy-lang";

const translations: Record<Lang, Record<string, string>> = {
  de: {
    "lang.de": "Deutsch",
    "lang.en": "Englisch",
    "theme.toLight": "Zu hellem Design wechseln",
    "theme.toDark": "Zu dunklem Design wechseln",
    "nav.projects": "Projekte",

    "common.cancel": "Abbrechen",
    "common.save": "Speichern",
    "common.create": "Anlegen",
    "common.delete": "Löschen",
    "common.rename": "Umbenennen",
    "common.edit": "Bearbeiten",
    "common.study": "Lernen",
    "common.back": "Zurück",
    "common.loading": "Lädt …",

    "projects.heading": "Deine Projekte",
    "projects.new": "Neues Projekt",
    "projects.empty": "Noch keine Projekte. Lege dein erstes Projekt an.",
    "projects.nameLabel": "Projektname",
    "projects.namePlaceholder": "z.B. Spanisch",
    "projects.newTitle": "Neues Projekt",
    "projects.renameTitle": "Projekt umbenennen",
    "projects.deleteConfirm": "Projekt „{name}“ inklusive aller Stapel und Karten wirklich löschen?",

    "project.notFound": "Projekt nicht gefunden.",
    "project.newDeck": "Neuer Stapel",
    "project.importDeck": "Stapel importieren (CSV)",
    "project.studyAll": "Alle Stapel gemischt lernen",
    "project.exportZip": "Projekt exportieren (ZIP)",
    "project.empty": "Noch keine Stapel. Lege deinen ersten Stapel an oder importiere eine CSV-Datei.",
    "project.deckNameLabel": "Stapelname",
    "project.deckNamePlaceholder": "z.B. Grundwortschatz",
    "project.newDeckTitle": "Neuer Stapel",
    "project.renameDeckTitle": "Stapel umbenennen",
    "project.deckDeleteConfirm": "Stapel „{name}“ inklusive aller Karten wirklich löschen?",

    "deck.addCard": "Karte hinzufügen",
    "deck.study": "Stapel lernen",
    "deck.importCsv": "CSV importieren",
    "deck.exportCsv": "CSV exportieren",
    "deck.empty": "Noch keine Karten. Füge manuell welche hinzu oder importiere eine CSV-Datei.",
    "deck.fallbackTitle": "Stapel",

    "card.bidirectional": "bidirektional",
    "card.oneway": "einseitig",
    "card.deleteConfirm": "Karte „{front}“ wirklich löschen?",
    "card.newTitle": "Neue Karte",
    "card.editTitle": "Karte bearbeiten",
    "card.front": "Vorderseite",
    "card.back": "Rückseite",
    "card.bidirectionalOption": "Bidirektional (in beide Richtungen abfragen)",
    "card.emptyError": "Vorder- und Rückseite dürfen nicht leer sein.",

    "study.itemsInRotation": "{count} Lern-Items im Umlauf",
    "study.answered": "Beantwortet: {count}",
    "study.correct": "Richtig: {count} ({percent} %)",
    "study.flip": "Umdrehen",
    "study.clickToFlip": "Klicken zum Umdrehen",
    "study.correctBtn": "Richtig",
    "study.wrongBtn": "Falsch",
    "study.end": "Session beenden",
    "study.noCards": "Keine Karten zum Lernen vorhanden.",

    "mastery.empty": "Noch keine Karten",
    "mastery.weak": "schwach",
    "mastery.moderate": "mäßig",
    "mastery.good": "gut",
    "mastery.excellent": "sehr gut",
    "mastery.secure": "{percent} % sicher",

    "stats.decks": "{count} Stapel",
    "stats.cards": "{count} Karten",
    "stats.cards.one": "1 Karte",
    "stats.decks.one": "1 Stapel",
    "bucket.new": "Neu",
    "bucket.learning": "Am Lernen",
    "bucket.known": "Gekonnt",
    "bucket.mastered": "Sicher",

    "dialog.nameRequired": "Bitte einen Namen eingeben.",
    "error.create": "Fehler beim Erstellen",
    "error.rename": "Fehler beim Umbenennen",
    "error.delete": "Fehler beim Löschen",
    "error.load": "Fehler beim Laden",
    "error.import": "Import fehlgeschlagen",
    "error.save": "Speichern fehlgeschlagen",

    "sync.title": "Synchronisierung",
    "sync.open": "Sync-Einstellungen öffnen",
    "sync.state.disabled": "Nicht eingerichtet",
    "sync.state.idle": "Synchron",
    "sync.state.syncing": "Synchronisiert …",
    "sync.state.conflict": "Konflikt",
    "sync.state.error": "Fehler",
    "sync.state.dirty": "Ungesicherte Änderungen",
    "sync.lastSynced": "Zuletzt: {time}",
    "sync.never": "Noch nie synchronisiert",
    "sync.now": "Jetzt synchronisieren",
    "sync.unlink": "Verknüpfung lösen",
    "sync.unlinkConfirm": "Sync-Verknüpfung wirklich lösen? Token und Repo-Auswahl werden entfernt, deine lokalen Karten bleiben erhalten.",

    "sync.step1": "1. GitHub-Token",
    "sync.tokenLabel": "Personal Access Token",
    "sync.tokenPlaceholder": "ghp_… oder github_pat_…",
    "sync.tokenCheck": "Token prüfen & Repos laden",
    "sync.tokenChange": "Token ändern",
    "sync.signedInAs": "Angemeldet als {login}",
    "sync.tokenHint":
      "Lege das Repo selbst auf GitHub an. Der Token braucht Schreibrechte auf den Repo-Inhalt (klassischer Token mit 'repo'-Scope, oder fine-grained mit 'Contents: Read and write'). Damit hier alle Repos zur Auswahl stehen, muss der Token Zugriff auf alle Repos haben — ein auf ein Repo beschränkter Token zeigt nur dieses.",

    "sync.step2": "2. Ziel-Repository",
    "sync.repoLabel": "Repository",
    "sync.repoFilter": "Repos filtern …",
    "sync.repoSelect": "Bitte auswählen …",
    "sync.repoPrivate": "privat",
    "sync.repoNone": "Keine Repos gefunden. Hat der Token Zugriff?",
    "sync.branchLabel": "Branch",
    "sync.pathLabel": "Dateiname im Repo",
    "sync.step3": "3. Optionen",
    "sync.deviceLabel": "Gerätename",
    "sync.autoSync": "Automatisch synchronisieren",
    "sync.intervalLabel": "Intervall (Minuten)",
    "sync.saved": "Einstellungen gespeichert.",
    "sync.needRepo": "Bitte ein Repository und einen Branch auswählen.",

    "sync.conflict.title": "Sync-Konflikt",
    "sync.conflict.intro":
      "Lokaler und entfernter Stand haben sich beide geändert. Wähle, welcher Stand gelten soll — der andere wird überschrieben.",
    "sync.conflict.local": "Lokaler Stand",
    "sync.conflict.remote": "Entfernter Stand",
    "sync.conflict.newer": "aktueller",
    "sync.conflict.device": "Gerät: {name}",
    "sync.conflict.changed": "Geändert: {time}",
    "sync.conflict.counts": "{projects} Projekte · {decks} Stapel · {cards} Karten",
    "sync.conflict.keepLocal": "Lokalen Stand übernehmen",
    "sync.conflict.keepRemote": "Entfernten Stand übernehmen",
    "sync.conflict.later": "Später",
  },
  en: {
    "lang.de": "German",
    "lang.en": "English",
    "theme.toLight": "Switch to light theme",
    "theme.toDark": "Switch to dark theme",
    "nav.projects": "Projects",

    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.create": "Create",
    "common.delete": "Delete",
    "common.rename": "Rename",
    "common.edit": "Edit",
    "common.study": "Study",
    "common.back": "Back",
    "common.loading": "Loading …",

    "projects.heading": "Your projects",
    "projects.new": "New project",
    "projects.empty": "No projects yet. Create your first project.",
    "projects.nameLabel": "Project name",
    "projects.namePlaceholder": "e.g. Spanish",
    "projects.newTitle": "New project",
    "projects.renameTitle": "Rename project",
    "projects.deleteConfirm": "Really delete project “{name}” including all decks and cards?",

    "project.notFound": "Project not found.",
    "project.newDeck": "New deck",
    "project.importDeck": "Import deck (CSV)",
    "project.studyAll": "Study all decks shuffled",
    "project.exportZip": "Export project (ZIP)",
    "project.empty": "No decks yet. Create your first deck or import a CSV file.",
    "project.deckNameLabel": "Deck name",
    "project.deckNamePlaceholder": "e.g. Core vocabulary",
    "project.newDeckTitle": "New deck",
    "project.renameDeckTitle": "Rename deck",
    "project.deckDeleteConfirm": "Really delete deck “{name}” including all cards?",

    "deck.addCard": "Add card",
    "deck.study": "Study deck",
    "deck.importCsv": "Import CSV",
    "deck.exportCsv": "Export CSV",
    "deck.empty": "No cards yet. Add some manually or import a CSV file.",
    "deck.fallbackTitle": "Deck",

    "card.bidirectional": "bidirectional",
    "card.oneway": "one-way",
    "card.deleteConfirm": "Really delete card “{front}”?",
    "card.newTitle": "New card",
    "card.editTitle": "Edit card",
    "card.front": "Front",
    "card.back": "Back",
    "card.bidirectionalOption": "Bidirectional (quiz in both directions)",
    "card.emptyError": "Front and back must not be empty.",

    "study.itemsInRotation": "{count} study items in rotation",
    "study.answered": "Answered: {count}",
    "study.correct": "Correct: {count} ({percent}%)",
    "study.flip": "Flip",
    "study.clickToFlip": "Click to flip",
    "study.correctBtn": "Correct",
    "study.wrongBtn": "Wrong",
    "study.end": "End session",
    "study.noCards": "No cards available to study.",

    "mastery.empty": "No cards yet",
    "mastery.weak": "weak",
    "mastery.moderate": "moderate",
    "mastery.good": "good",
    "mastery.excellent": "excellent",
    "mastery.secure": "{percent}% confident",

    "stats.decks": "{count} decks",
    "stats.cards": "{count} cards",
    "stats.cards.one": "1 card",
    "stats.decks.one": "1 deck",
    "bucket.new": "New",
    "bucket.learning": "Learning",
    "bucket.known": "Known",
    "bucket.mastered": "Mastered",

    "dialog.nameRequired": "Please enter a name.",
    "error.create": "Failed to create",
    "error.rename": "Failed to rename",
    "error.delete": "Failed to delete",
    "error.load": "Failed to load",
    "error.import": "Import failed",
    "error.save": "Failed to save",

    "sync.title": "Sync",
    "sync.open": "Open sync settings",
    "sync.state.disabled": "Not set up",
    "sync.state.idle": "In sync",
    "sync.state.syncing": "Syncing …",
    "sync.state.conflict": "Conflict",
    "sync.state.error": "Error",
    "sync.state.dirty": "Unsynced changes",
    "sync.lastSynced": "Last: {time}",
    "sync.never": "Never synced",
    "sync.now": "Sync now",
    "sync.unlink": "Unlink",
    "sync.unlinkConfirm": "Really unlink sync? The token and repo selection are removed; your local cards stay untouched.",

    "sync.step1": "1. GitHub token",
    "sync.tokenLabel": "Personal access token",
    "sync.tokenPlaceholder": "ghp_… or github_pat_…",
    "sync.tokenCheck": "Check token & load repos",
    "sync.tokenChange": "Change token",
    "sync.signedInAs": "Signed in as {login}",
    "sync.tokenHint":
      "Create the repo yourself on GitHub. The token needs write access to repository contents (classic token with the 'repo' scope, or fine-grained with 'Contents: Read and write'). For all your repos to appear here, the token must have access to all of them — a token scoped to a single repo will only show that one.",

    "sync.step2": "2. Target repository",
    "sync.repoLabel": "Repository",
    "sync.repoFilter": "Filter repos …",
    "sync.repoSelect": "Please select …",
    "sync.repoPrivate": "private",
    "sync.repoNone": "No repos found. Does the token have access?",
    "sync.branchLabel": "Branch",
    "sync.pathLabel": "File name in repo",
    "sync.step3": "3. Options",
    "sync.deviceLabel": "Device name",
    "sync.autoSync": "Sync automatically",
    "sync.intervalLabel": "Interval (minutes)",
    "sync.saved": "Settings saved.",
    "sync.needRepo": "Please select a repository and a branch.",

    "sync.conflict.title": "Sync conflict",
    "sync.conflict.intro":
      "Local and remote both changed. Choose which one wins — the other will be overwritten.",
    "sync.conflict.local": "Local version",
    "sync.conflict.remote": "Remote version",
    "sync.conflict.newer": "newer",
    "sync.conflict.device": "Device: {name}",
    "sync.conflict.changed": "Changed: {time}",
    "sync.conflict.counts": "{projects} projects · {decks} decks · {cards} cards",
    "sync.conflict.keepLocal": "Keep local version",
    "sync.conflict.keepRemote": "Keep remote version",
    "sync.conflict.later": "Later",
  },
};

export type TranslateKey = keyof (typeof translations)["de"];

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

interface LocaleContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslateKey, vars?: Vars) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function initialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "de" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const t = (key: TranslateKey, vars?: Vars): string =>
    interpolate(translations[lang][key] ?? translations.de[key] ?? key, vars);

  return <LocaleContext.Provider value={{ lang, setLang, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
