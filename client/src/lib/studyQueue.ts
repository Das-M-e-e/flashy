import type { Card, Direction } from "../types";

export interface StudyItem {
  cardId: string;
  deckId: string;
  direction: Direction;
  front: string;
  back: string;
  correctCount: number;
  incorrectCount: number;
}

export function cardToStudyItems(card: Card): StudyItem[] {
  const items: StudyItem[] = [];
  for (const stat of card.stats) {
    const isForward = stat.direction === "forward";
    items.push({
      cardId: card.id,
      deckId: card.deckId,
      direction: stat.direction,
      front: isForward ? card.front : card.back,
      back: isForward ? card.back : card.front,
      correctCount: stat.correctCount,
      incorrectCount: stat.incorrectCount,
    });
  }
  return items;
}

function level(item: StudyItem): number {
  return Math.max(0, item.correctCount - item.incorrectCount);
}

function weight(item: StudyItem): number {
  return 1 / (level(item) + 1);
}

function itemKey(item: StudyItem): string {
  return `${item.cardId}:${item.direction}`;
}

/**
 * Zieht Lern-Items gewichtet nach Erfolgsbilanz (correctCount - incorrectCount):
 * Karten mit hohem Wert erscheinen seltener, aber nie ganz ausgeschlossen.
 */
export class StudyQueue {
  private items: StudyItem[];
  private lastDrawnAt = new Map<string, number>();
  private drawCount = 0;

  constructor(items: StudyItem[]) {
    this.items = items;
  }

  get size(): number {
    return this.items.length;
  }

  updateItem(cardId: string, direction: Direction, correct: boolean): void {
    const item = this.items.find((it) => it.cardId === cardId && it.direction === direction);
    if (!item) return;
    if (correct) item.correctCount += 1;
    else item.incorrectCount += 1;
  }

  next(): StudyItem | null {
    if (this.items.length === 0) return null;
    if (this.items.length === 1) return this.items[0];

    const eligible = this.items.filter((item) => {
      const last = this.lastDrawnAt.get(itemKey(item));
      if (last === undefined) return true;
      const requiredGap = Math.min(this.items.length - 1, level(item) + 2);
      return this.drawCount - last > requiredGap;
    });

    const pool = eligible.length > 0 ? eligible : this.items;
    const totalWeight = pool.reduce((sum, item) => sum + weight(item), 0);
    let roll = Math.random() * totalWeight;
    let chosen = pool[pool.length - 1];
    for (const item of pool) {
      roll -= weight(item);
      if (roll <= 0) {
        chosen = item;
        break;
      }
    }

    this.lastDrawnAt.set(itemKey(chosen), this.drawCount);
    this.drawCount += 1;
    return chosen;
  }
}
