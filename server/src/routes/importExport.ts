import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import JSZip from "jszip";
import multer from "multer";
import * as db from "../db";
import { parseCsv, toCsv } from "../csv";

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

// CSVs mit eingebetteten Bildern (data-URIs) werden schnell groß.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/** Ohne das würde ein zu großer Upload als HTML-500 statt als JSON zurückkommen. */
function uploadCsv(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? `Datei ist zu groß (maximal ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`
          : err.message,
      });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "stapel";
}

export const deckImportRouter = Router({ mergeParams: true });

deckImportRouter.post("/", uploadCsv, (req: Request<{ deckId: string }>, res) => {
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
    db.createCard(randomUUID(), deck.id, {
      front: row.front,
      back: row.back,
      bidirectional: row.bidirectional,
    });
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
