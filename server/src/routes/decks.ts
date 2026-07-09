import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import * as db from "../db";

export const decksRouter = Router();

// Nested under /api/projects/:projectId/decks
export const projectDecksRouter = Router({ mergeParams: true });

type ProjectParams = Request<{ projectId: string }>;

projectDecksRouter.get("/", (req: ProjectParams, res) => {
  res.json(db.listDecksByProject(req.params.projectId));
});

projectDecksRouter.post("/", (req: ProjectParams, res) => {
  const project = db.getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: "Projekt nicht gefunden" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Name ist erforderlich" });
    return;
  }
  const deck = db.createDeck(randomUUID(), project.id, name);
  res.status(201).json(deck);
});

// Standalone /api/decks/:id
decksRouter.get("/:id", (req, res) => {
  const deck = db.getDeck(req.params.id);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  res.json(deck);
});

decksRouter.put("/:id", (req, res) => {
  const deck = db.getDeck(req.params.id);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Name ist erforderlich" });
    return;
  }
  db.renameDeck(deck.id, name);
  res.json(db.getDeck(deck.id));
});

decksRouter.delete("/:id", (req, res) => {
  db.deleteDeck(req.params.id);
  res.status(204).end();
});
