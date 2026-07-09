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

export interface DeckStats {
  deckId: string;
  itemCount: number;
  masteryPercent: number;
  masteryLabel: "schwach" | "mäßig" | "gut" | "sehr gut" | "keine Karten";
}
