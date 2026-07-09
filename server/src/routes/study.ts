import { Router, type Request } from "express";
import * as db from "../db";

export const deckStatsRouter = Router({ mergeParams: true });

deckStatsRouter.get("/", (req: Request<{ deckId: string }>, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  const cards = db.listCardsByDeck(deck.id);
  const stats = db.computeMastery(cards);
  res.json({ ...stats, deckId: deck.id });
});

export const projectStudyRouter = Router({ mergeParams: true });

projectStudyRouter.get("/", (req: Request<{ projectId: string }>, res) => {
  const project = db.getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: "Projekt nicht gefunden" });
    return;
  }
  res.json(db.listCardsByProject(project.id));
});
