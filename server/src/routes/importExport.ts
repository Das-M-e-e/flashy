import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import JSZip from "jszip";
import multer from "multer";
import * as db from "../db";
import { parseCsv, toCsv } from "../csv";

const upload = multer({ storage: multer.memoryStorage() });

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "stapel";
}

export const deckImportRouter = Router({ mergeParams: true });

deckImportRouter.post("/", upload.single("file"), (req: Request<{ deckId: string }>, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }
  const rows = parseCsv(req.file.buffer.toString("utf-8"));
  for (const row of rows) {
    db.createCard(randomUUID(), deck.id, row.front, row.back, row.bidirectional);
  }
  res.status(201).json({ imported: rows.length, cards: db.listCardsByDeck(deck.id) });
});

export const deckExportRouter = Router({ mergeParams: true });

deckExportRouter.get("/", (req: Request<{ deckId: string }>, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  const cards = db.listCardsByDeck(deck.id);
  const csv = toCsv(cards.map((card) => ({ front: card.front, back: card.back, bidirectional: card.bidirectional })));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFileName(deck.name)}.csv"`);
  res.send(csv);
});

export const projectExportRouter = Router({ mergeParams: true });

projectExportRouter.get("/", async (req: Request<{ projectId: string }>, res) => {
  const project = db.getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: "Projekt nicht gefunden" });
    return;
  }
  const decks = db.listDecksByProject(project.id);
  const zip = new JSZip();
  for (const deck of decks) {
    const cards = db.listCardsByDeck(deck.id);
    const csv = toCsv(cards.map((card) => ({ front: card.front, back: card.back, bidirectional: card.bidirectional })));
    zip.file(`${sanitizeFileName(deck.name)}.csv`, csv);
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFileName(project.name)}.zip"`);
  res.send(buffer);
});
