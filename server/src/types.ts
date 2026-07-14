export type Direction = "forward" | "backward";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Deck {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface CardStat {
  direction: Direction;
  correctCount: number;
  incorrectCount: number;
}

export type CardType = "basic" | "type_answer" | "choice" | "truefalse" | "cloze";

export interface ChoiceOption {
  text: string;
  correct: boolean;
}

export interface CardData {
  /** choice: Auswahlmöglichkeiten */
  options?: ChoiceOption[];
  /** choice: Mehrfachauswahl erlaubt */
  multi?: boolean;
  /** type_answer: zusätzlich akzeptierte Antwortvarianten */
  answers?: string[];
  /** truefalse: die korrekte Aussage */
  answer?: boolean;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  bidirectional: boolean;
  type: CardType;
  data: CardData | null;
  createdAt: string;
  updatedAt: string;
  stats: CardStat[];
}

export type MasteryLevel = "empty" | "weak" | "moderate" | "good" | "excellent";

export interface MasteryBuckets {
  new: number;
  learning: number;
  known: number;
  mastered: number;
}

export interface MasterySummary {
  itemCount: number;
  masteryPercent: number;
  masteryLabel: MasteryLevel;
  buckets: MasteryBuckets;
}

export interface DeckStats extends MasterySummary {
  deckId: string;
}

export interface ProjectStats extends MasterySummary {
  projectId: string;
  deckCount: number;
  cardCount: number;
}

// ---------- Sync ----------

export interface SnapshotCounts {
  projects: number;
  decks: number;
  cards: number;
}

export interface Snapshot {
  formatVersion: number;
  deviceName: string;
  updatedAt: string;
  counts: SnapshotCounts;
  data: {
    projects: Project[];
    decks: Deck[];
    cards: Card[];
    /** Nur bewertete Prüfungen (Historie); ab formatVersion 3. */
    exams?: Exam[];
  };
}

/** Zusammenfassung eines Standes, wie sie im Konflikt-Popup angezeigt wird. */
export interface SnapshotSummary {
  deviceName: string;
  updatedAt: string;
  counts: SnapshotCounts;
}

export interface ConflictInfo {
  local: SnapshotSummary;
  remote: SnapshotSummary;
  /** Welcher Stand ist der zeitlich jüngere? */
  newer: "local" | "remote";
}

export type SyncStateName = "disabled" | "idle" | "syncing" | "conflict" | "error";

export interface SyncStatus {
  state: SyncStateName;
  dirty: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  conflict: ConflictInfo | null;
  dataVersion: number;
}

export interface SyncConfigView {
  configured: boolean;
  owner: string | null;
  repo: string | null;
  branch: string | null;
  path: string;
  hasToken: boolean;
  githubLogin: string | null;
  deviceName: string;
  autoSync: boolean;
  intervalMinutes: number;
}

export interface RepoOption {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

// ---------- LLM-Anbindung ----------

/**
 * Provider für die Prüfungs-Features. Beide sprechen die OpenAI-kompatible
 * Chat-Completions-Schnittstelle -- `github_models` ist nur ein Preset mit
 * fester Basis-URL, dessen "Key" ein GitHub-PAT mit Models-Zugriff ist.
 */
export type LlmProvider = "openai_compatible" | "github_models";

/** Nach außen (Client) sichtbare LLM-Konfiguration -- ohne den Key selbst. */
export interface LlmConfigView {
  configured: boolean;
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

// ---------- Prüfungen ----------

export type ExamStatus =
  | "draft" // wird konfiguriert
  | "generating" // LLM erstellt die Prüfung
  | "ready" // fertig erstellt, noch nicht gestartet
  | "in_progress" // Timer läuft, User bearbeitet (nur lokal/gerätegebunden)
  | "submitted" // abgegeben, wartet auf Bewertung
  | "grading" // LLM bewertet
  | "graded" // fertig bewertet (Historie, wird gesynct)
  | "error";

/** Ein abgefragtes Thema -- entspricht einem Stapel im Projekt. */
export interface ExamTopic {
  deckId: string;
  name: string;
  /** Vom User vergebene Punkte für dieses Thema (null = automatisch verteilen). */
  points: number | null;
}

export interface ExamConfig {
  /** Ausgewählte Stapel (= Themen). */
  deckIds: string[];
  /** Explizit ausgewählte Karten; null = alle Karten der Themen. */
  cardIds: string[] | null;
  topics: ExamTopic[];
  /** 0 = alles 1:1 abfragen, 1 = alles Transfer-/Anwendungsaufgaben. */
  transferRatio: number;
  /** Karten, die explizit 1:1 abgefragt werden sollen. */
  directCardIds: string[];
  answerFormat: "text" | "mc" | "mixed";
  /** MC-Anteil bei "mixed" (0..1). */
  mcRatio: number;
  durationSeconds: number;
  totalPoints: number;
  /** Punkte pro Thema getrennt vergeben statt Gesamtpunktzahl aufteilen. */
  perTopicPoints: boolean;
  subject: string;
  allowedAids: string;
  language: "de" | "en" | "auto";
}

export type ExamTaskFormat = "text" | "mc";

/** Eine einzelne Aufgabe der erstellten Prüfung. */
export interface ExamTask {
  id: string;
  topicDeckId: string | null;
  format: ExamTaskFormat;
  prompt: string;
  /** Nur bei MC-Aufgaben. */
  options?: string[];
  /** Musterlösung / Bewertungskriterien -- vor Abgabe nie an den Client gesynct. */
  expected?: string;
  points: number;
}

export interface ExamPaper {
  subject: string;
  topicNames: string[];
  totalPoints: number;
  durationSeconds: number;
  allowedAids: string;
  tasks: ExamTask[];
}

/** Bewertung einer einzelnen Aufgabe. */
export interface ExamTaskResult {
  taskId: string;
  awardedPoints: number;
  maxPoints: number;
  comment: string;
}

export interface ExamResult {
  taskResults: ExamTaskResult[];
  totalAwarded: number;
  totalPoints: number;
  /** Freitext: welche Themen sitzen, wo ist Verbesserungspotenzial. */
  feedback: string;
}

export interface Exam {
  id: string;
  projectId: string;
  deckId: string | null;
  title: string;
  status: ExamStatus;
  config: ExamConfig;
  paper: ExamPaper | null;
  answers: Record<string, string> | null;
  result: ExamResult | null;
  /** Gerät, auf dem die Prüfung gestartet wurde (Bindung laufender Prüfungen). */
  boundDevice: string | null;
  startedAt: string | null;
  durationSeconds: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
