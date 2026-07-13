import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import * as db from "../db";
import type { CardData, CardType, ChoiceOption, Direction } from "../types";

export const cardsRouter = Router();

// Nested under /api/decks/:deckId/cards
export const deckCardsRouter = Router({ mergeParams: true });

type DeckParams = Request<{ deckId: string }>;

const CARD_TYPES: CardType[] = ["basic", "type_answer", "choice", "truefalse", "cloze"];

/** Validiert den Request-Body und baut eine typgerechte CardInput. Wirft bei Fehlern. */
function parseCardInput(body: unknown): db.CardInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const front = String(b.front ?? "").trim();
  const back = String(b.back ?? "").trim();
  const type: CardType = CARD_TYPES.includes(b.type as CardType) ? (b.type as CardType) : "basic";

  if (!front) throw new Error("Die Frage/Vorderseite ist erforderlich");

  const data: CardData = {};
  if (type === "basic" || type === "type_answer") {
    if (!back) throw new Error("Die Antwort/Rückseite ist erforderlich");
  }
  if (type === "type_answer") {
    const answers = Array.isArray(b.data && (b.data as CardData).answers)
      ? ((b.data as CardData).answers as string[]).map((a) => String(a).trim()).filter(Boolean)
      : [];
    if (answers.length) data.answers = answers;
  }
  if (type === "choice") {
    const rawOptions = ((b.data as CardData | undefined)?.options ?? []) as ChoiceOption[];
    const options = rawOptions
      .map((o) => ({ text: String(o.text ?? "").trim(), correct: Boolean(o.correct) }))
      .filter((o) => o.text);
    if (options.length < 2) throw new Error("Multiple Choice braucht mindestens zwei Optionen");
    if (!options.some((o) => o.correct)) throw new Error("Mindestens eine Option muss richtig sein");
    data.options = options;
    data.multi = Boolean((b.data as CardData | undefined)?.multi);
  }
  if (type === "truefalse") {
    data.answer = Boolean((b.data as CardData | undefined)?.answer);
  }
  if (type === "cloze") {
    if (!/\{\{c\d+::/.test(front)) throw new Error("Cloze braucht mindestens eine Lücke {{c1::…}}");
  }

  return { front, back, bidirectional: Boolean(b.bidirectional ?? true), type, data };
}

deckCardsRouter.get("/", (req: DeckParams, res) => {
  res.json(db.listCardsByDeck(req.params.deckId));
});

deckCardsRouter.post("/", (req: DeckParams, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  let input: db.CardInput;
  try {
    input = parseCardInput(req.body);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Ungültige Karte" });
    return;
  }
  res.status(201).json(db.createCard(randomUUID(), deck.id, input));
});

// Standalone /api/cards/:id
cardsRouter.put("/:id", (req, res) => {
  const existing = db.getCard(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Karte nicht gefunden" });
    return;
  }
  let input: db.CardInput;
  try {
    input = parseCardInput(req.body);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Ungültige Karte" });
    return;
  }
  res.json(db.updateCard(existing.id, input));
});

cardsRouter.delete("/:id", (req, res) => {
  db.deleteCard(req.params.id);
  res.status(204).end();
});

cardsRouter.post("/:id/answer", (req, res) => {
  const card = db.getCard(req.params.id);
  if (!card) {
    res.status(404).json({ error: "Karte nicht gefunden" });
    return;
  }
  const direction = req.body?.direction as Direction;
  const correct = Boolean(req.body?.correct);
  if (direction !== "forward" && direction !== "backward") {
    res.status(400).json({ error: "Ungültige Richtung" });
    return;
  }
  db.recordAnswer(card.id, direction, correct);
  res.json(db.getCard(card.id));
});
