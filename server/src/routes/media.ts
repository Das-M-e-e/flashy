import fs from "node:fs";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import * as db from "../db";

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MEDIA_BYTES } });

function uploadMedia(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? `Mediendatei ist zu groß (maximal ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)} MB)`
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

export const mediaRouter = Router();

mediaRouter.post("/", uploadMedia, (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }
  const mime = req.file.mimetype || "application/octet-stream";
  const ext = db.extForMime(mime, req.file.originalname);
  const meta = db.saveMedia(req.file.buffer, mime, ext);
  res.status(201).json({ ref: meta.ref, mime: meta.mime, size: meta.size });
});

// GET /api/media/<hash>.<ext>
mediaRouter.get("/:file", (req, res) => {
  const parsed = db.parseMediaRef(`media/${req.params.file}`);
  if (!parsed) {
    res.status(400).json({ error: "Ungültige Medien-Referenz" });
    return;
  }
  const row = db.getMedia(parsed.hash);
  if (!row) {
    res.status(404).json({ error: "Medium nicht gefunden" });
    return;
  }
  const filePath = db.mediaFilePath(row.hash, row.ext);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Mediendatei fehlt" });
    return;
  }
  // Inhaltsadressiert -> unveränderlich, aggressiv cachebar.
  res.setHeader("Content-Type", row.mime);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  fs.createReadStream(filePath).pipe(res);
});
