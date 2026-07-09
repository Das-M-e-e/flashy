import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import * as db from "../db";
import type { Direction } from "../types";

export const cardsRouter = Router();

// Nested under /api/decks/:deckId/cards
export const deckCardsRouter = Router({ mergeParams: true });

type DeckParams = Request<{ deckId: string }>;

deckCardsRouter.get("/", (req: DeckParams, res) => {
  res.json(db.listCardsByDeck(req.params.deckId));
});

deckCardsRouter.post("/", (req: DeckParams, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  const front = String(req.body?.front ?? "").trim();
  const back = String(req.body?.back ?? "").trim();
  const bidirectional = Boolean(req.body?.bidirectional ?? true);
  if (!front || !back) {
    res.status(400).json({ error: "Vorder- und Rückseite sind erforderlich" });
    return;
  }
  const card = db.createCard(randomUUID(), deck.id, front, back, bidirectional);
  res.status(201).json(card);
});

// Standalone /api/cards/:id
cardsRouter.put("/:id", (req, res) => {
  const existing = db.getCard(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Karte nicht gefunden" });
    return;
  }
  const front = String(req.body?.front ?? "").trim();
  const back = String(req.body?.back ?? "").trim();
  const bidirectional = Boolean(req.body?.bidirectional ?? true);
  if (!front || !back) {
    res.status(400).json({ error: "Vorder- und Rückseite sind erforderlich" });
    return;
  }
  const card = db.updateCard(existing.id, front, back, bidirectional);
  res.json(card);
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
