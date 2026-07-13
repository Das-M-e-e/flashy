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
