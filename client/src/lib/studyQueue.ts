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

// Fibonacci-artige Staffelung: je höher das Level, desto weiter rückt eine
// richtig beantwortete Karte nach hinten.
const STEP = [1, 2, 3, 5, 8, 13, 21];

function jitter(base: number): number {
  return Math.max(1, Math.round(base * (0.8 + Math.random() * 0.4)));
}

function itemKey(item: StudyItem): string {
  return `${item.cardId}:${item.direction}`;
}

interface Entry {
  item: StudyItem;
  due: number;
}

/**
 * Fälligkeitsbasierte Warteschlange statt gewichtetem Zufall.
 *
 * Jedes Lern-Item hat eine virtuelle Fälligkeitsposition `due` auf einer
 * fortlaufenden Uhr. `next()` liefert stets das überfälligste Item. Nach der
 * Antwort wird es um einen Abstand nach hinten einsortiert, der bei richtigen
 * Antworten mit dem Level wächst und bei falschen klein bleibt. So kommen
 * schwache Karten häufig, gut gekonnte erst viel später wieder — ohne dass eine
 * Karte je ganz herausfällt oder sich direkt wiederholt.
 */
export class StudyQueue {
  private entries: Entry[];
  private clock = 0;
  private lastKey: string | null = null;

  constructor(items: StudyItem[]) {
    // Neue Karten (Level 0) zuerst; gut gekonnte weiter hinten. Kleiner
    // Zufalls-Tiebreak, damit gleichrangige Items nicht in fixer Reihenfolge kommen.
    this.entries = items.map((item) => ({ item, due: level(item) + Math.random() * 0.5 }));
  }

  get size(): number {
    return this.entries.length;
  }

  next(): StudyItem | null {
    if (this.entries.length === 0) return null;
    if (this.entries.length === 1) return this.entries[0].item;

    let chosen: Entry | null = null;
    for (const entry of this.entries) {
      // Dieselbe Karte nie zweimal direkt hintereinander (Kernärger der alten Logik).
      if (itemKey(entry.item) === this.lastKey) continue;
      if (!chosen || entry.due < chosen.due) chosen = entry;
    }
    // Fallback (sollte bei ≥2 Items nicht eintreten): erstes Item nehmen.
    if (!chosen) chosen = this.entries[0];
    return chosen.item;
  }

  updateItem(cardId: string, direction: Direction, correct: boolean): void {
    const entry = this.entries.find(
      (e) => e.item.cardId === cardId && e.item.direction === direction
    );
    if (!entry) return;

    if (correct) entry.item.correctCount += 1;
    else entry.item.incorrectCount += 1;

    const lvl = level(entry.item);
    let gap = correct ? jitter(STEP[Math.min(lvl, STEP.length - 1)]) : jitter(2);
    // Bei genügend Items nie direkt wieder vorne einsortieren.
    if (this.entries.length >= 3) gap = Math.max(gap, 2);

    entry.due = this.clock + gap;
    this.clock += 1;
    this.lastKey = itemKey(entry.item);
  }
}
