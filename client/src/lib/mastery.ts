import type { Card, CardStat, Direction } from "../types";

export type Bucket = "new" | "learning" | "known" | "mastered";

/** Bucket-Reihenfolge von schwach nach stark (für Sortierung/Vergleich). */
export const BUCKET_ORDER: Bucket[] = ["new", "learning", "known", "mastered"];

/** Spiegelt die Server-Schwellen aus db.ts (summarize): Cap 5. */
export function levelOfStat(stat: CardStat): number {
  return Math.max(0, stat.correctCount - stat.incorrectCount);
}

export function bucketOfLevel(level: number): Bucket {
  if (level === 0) return "new";
  if (level <= 2) return "learning";
  if (level <= 4) return "known";
  return "mastered";
}

export interface DirectionConfidence {
  direction: Direction;
  level: number;
  bucket: Bucket;
}

export interface CardConfidenceInfo {
  directions: DirectionConfidence[];
  /** Schwächste Richtung -- danach wird sortiert und gefiltert. */
  minLevel: number;
  minBucket: Bucket;
}

export function cardConfidence(card: Card): CardConfidenceInfo {
  // forward zuerst, backward danach -- stabile Anzeige-Reihenfolge.
  const ordered = [...card.stats].sort((a, b) =>
    a.direction === b.direction ? 0 : a.direction === "forward" ? -1 : 1
  );
  const directions: DirectionConfidence[] = ordered.map((stat) => {
    const level = levelOfStat(stat);
    return { direction: stat.direction, level, bucket: bucketOfLevel(level) };
  });
  const minLevel = directions.length
    ? Math.min(...directions.map((d) => d.level))
    : 0;
  return { directions, minLevel, minBucket: bucketOfLevel(minLevel) };
}
