import type { Card, CardType } from "../types";

/** Zusätzlich wählbare Spalten/Eigenschaften beim Export (front/back sind immer dabei). */
export const EXPORTABLE_FIELDS = [
  "type",
  "bidirectional",
  "level",
  "percent",
  "correct",
  "incorrect",
  "created",
  "updated",
] as const;

export type ExportField = (typeof EXPORTABLE_FIELDS)[number];

const MASTERY_CAP = 5;

export function cardLevels(card: Card): { min: number; correct: number; incorrect: number } {
  const stats = card.stats ?? [];
  if (stats.length === 0) return { min: 0, correct: 0, incorrect: 0 };
  let min = Infinity;
  let correct = 0;
  let incorrect = 0;
  for (const s of stats) {
    const level = Math.max(0, s.correctCount - s.incorrectCount);
    min = Math.min(min, level);
    correct += s.correctCount;
    incorrect += s.incorrectCount;
  }
  return { min: Number.isFinite(min) ? min : 0, correct, incorrect };
}

/** Wert einer Metadaten-Eigenschaft als String (für CSV) bzw. Rohwert (für JSON). */
export function fieldValue(card: Card, key: ExportField): string | number | boolean {
  const lv = cardLevels(card);
  switch (key) {
    case "type":
      return card.type;
    case "bidirectional":
      return card.bidirectional;
    case "level":
      return lv.min;
    case "percent":
      return Math.round((Math.min(lv.min, MASTERY_CAP) / MASTERY_CAP) * 100);
    case "correct":
      return lv.correct;
    case "incorrect":
      return lv.incorrect;
    case "created":
      return card.createdAt;
    case "updated":
      return card.updatedAt;
  }
}

const CLOZE_RE = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Cloze-Text mit Antworten (für verlustbehaftete Q/A-Formate). */
export function clozeAnswers(text: string): string {
  const answers: string[] = [];
  for (const m of text.matchAll(CLOZE_RE)) answers.push(m[1].trim());
  return answers.join(", ");
}

/** Cloze-Text mit verdeckten Lücken. */
export function clozeMasked(text: string): string {
  return text.replace(CLOZE_RE, (_all, _answer, hint?: string) => (hint ? `[${hint.trim()}]` : "[…]"));
}

/** Reduziert eine Karte auf ein einfaches Frage/Antwort-Paar (für Anki-Basic/Quizlet/CSV). */
export function degraded(card: Card): { front: string; back: string } {
  switch (card.type) {
    case "choice":
      return {
        front: card.front,
        back: (card.data?.options ?? [])
          .filter((o) => o.correct)
          .map((o) => o.text)
          .join(", "),
      };
    case "truefalse":
      return { front: card.front, back: card.data?.answer ? "True" : "False" };
    case "cloze":
      return { front: clozeMasked(card.front), back: clozeAnswers(card.front) };
    default:
      return { front: card.front, back: card.back };
  }
}

export function filterByType(cards: Card[], cardTypes?: CardType[] | null): Card[] {
  if (!cardTypes || cardTypes.length === 0) return cards;
  const allow = new Set(cardTypes);
  return cards.filter((c) => allow.has(c.type));
}

const MEDIA_REF_RE = /media\/[a-f0-9]{64}\.[a-z0-9]+/gi;

export function mediaRefsOf(cards: Card[]): Set<string> {
  const refs = new Set<string>();
  for (const c of cards) {
    const hay = `${c.front}\n${c.back}\n${c.data ? JSON.stringify(c.data) : ""}`;
    for (const m of hay.matchAll(MEDIA_REF_RE)) refs.add(m[0].toLowerCase());
  }
  return refs;
}
