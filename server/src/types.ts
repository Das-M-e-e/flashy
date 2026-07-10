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

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  bidirectional: boolean;
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
