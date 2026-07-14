import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import * as db from "../db";
import { exportDeck, exportProject, importData, type ExportOptions, type ImportedCard } from "../formats";

const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function uploadFile(req: Request, res: Response, next: NextFunction): void {
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

const MEDIA_REF_RE = /media\/[a-f0-9]{64}\.[a-z0-9]+/gi;

/**
 * Legt importierte Mediendateien ab (mit echtem Hash) und liefert eine Ersetzungs-
 * Tabelle alte -> neue Referenz, falls die Datei-Bytes von der Referenz abweichen.
 */
function storeImportedMedia(media: Map<string, Buffer>): Map<string, string> {
  const rename = new Map<string, string>();
  for (const [ref, bytes] of media) {
    const parsed = db.parseMediaRef(ref);
    const ext = parsed?.ext ?? "bin";
    const meta = db.saveMedia(bytes, db.mimeForExt(ext), ext);
    if (meta.ref !== ref.toLowerCase()) rename.set(ref.toLowerCase(), meta.ref);
  }
  return rename;
}

function applyRename(text: string, rename: Map<string, string>): string {
  if (rename.size === 0) return text;
  return text.replace(MEDIA_REF_RE, (m) => rename.get(m.toLowerCase()) ?? m);
}

function parseExportOptions(body: unknown): ExportOptions {
  const b = (body ?? {}) as Record<string, unknown>;
  const format = b.format as ExportOptions["format"];
  return {
    format: ["flashy", "genericJson", "anki", "quizlet", "csv"].includes(format) ? format : "flashy",
    cardTypes: Array.isArray(b.cardTypes) ? (b.cardTypes as ExportOptions["cardTypes"]) : null,
    fields: Array.isArray(b.fields) ? (b.fields as ExportOptions["fields"]) : [],
  };
}

function sendFile(res: Response, file: { filename: string; mime: string; buffer: Buffer }): void {
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
}

// ---------- Import ----------

export const deckImportRouter = Router({ mergeParams: true });

deckImportRouter.post("/", uploadFile, async (req: Request<{ deckId: string }>, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }

  let parsed: { cards: ImportedCard[]; media: Map<string, Buffer> };
  try {
    parsed = await importData(req.file.buffer, req.file.originalname || "import");
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import fehlgeschlagen" });
    return;
  }

  const rename = storeImportedMedia(parsed.media);

  for (const { input, stats } of parsed.cards) {
    const card = db.createCard(randomUUID(), deck.id, {
      ...input,
      front: applyRename(input.front, rename),
      back: applyRename(input.back, rename),
    });
    if (stats && stats.length) db.setCardStatsRows(card.id, stats);
  }

  res.status(201).json({ imported: parsed.cards.length, cards: db.listCardsByDeck(deck.id) });
});

// ---------- Export (Deck) ----------

export const deckExportRouter = Router({ mergeParams: true });

deckExportRouter.post("/", async (req: Request<{ deckId: string }>, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  const file = await exportDeck(db.listCardsByDeck(deck.id), deck.name, parseExportOptions(req.body));
  sendFile(res, file);
});

// ---------- Export (Projekt) ----------

export const projectExportRouter = Router({ mergeParams: true });

projectExportRouter.post("/", async (req: Request<{ projectId: string }>, res) => {
  const project = db.getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: "Projekt nicht gefunden" });
    return;
  }
  const decks = db.listDecksByProject(project.id).map((d) => ({ name: d.name, cards: db.listCardsByDeck(d.id) }));
  const file = await exportProject(decks, project.name, parseExportOptions(req.body));
  sendFile(res, file);
});
