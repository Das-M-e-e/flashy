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
  options?: ChoiceOption[];
  multi?: boolean;
  answers?: string[];
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

export interface CardInput {
  front: string;
  back: string;
  bidirectional: boolean;
  type: CardType;
  data?: CardData | null;
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

export interface SnapshotSummary {
  deviceName: string;
  updatedAt: string;
  counts: SnapshotCounts;
}

export interface ConflictInfo {
  local: SnapshotSummary;
  remote: SnapshotSummary;
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

export type LlmProvider = "openai_compatible" | "github_models";

export interface LlmConfigView {
  configured: boolean;
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

// ---------- Prüfungen ----------

export type ExamStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_progress"
  | "submitted"
  | "grading"
  | "graded"
  | "error";

export interface ExamTopic {
  deckId: string;
  name: string;
  points: number | null;
}

export interface ExamConfig {
  deckIds: string[];
  cardIds: string[] | null;
  topics: ExamTopic[];
  transferRatio: number;
  directCardIds: string[];
  answerFormat: "text" | "mc" | "mixed";
  mcRatio: number;
  durationSeconds: number;
  totalPoints: number;
  perTopicPoints: boolean;
  subject: string;
  allowedAids: string;
  language: "de" | "en" | "auto";
}

export type ExamTaskFormat = "text" | "mc";

export interface ExamTask {
  id: string;
  topicDeckId: string | null;
  format: ExamTaskFormat;
  prompt: string;
  options?: string[];
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
  boundDevice: string | null;
  startedAt: string | null;
  durationSeconds: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
