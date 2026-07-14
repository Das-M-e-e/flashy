import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import JSZip from "jszip";

export const skillRouter = Router();

const SKILL_NAME = "flashy-flashcards";
// server/(src|dist)/routes -> Repo-Wurzel -> skills/<name>
const skillDir = path.join(__dirname, "..", "..", "..", "skills", SKILL_NAME);

/** Rohe SKILL.md ansehen/herunterladen. */
skillRouter.get("/flashcards.md", (_req, res) => {
  const file = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: "Skill nicht gefunden" });
    return;
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="SKILL.md"');
  res.send(fs.readFileSync(file, "utf-8"));
});

/** Ganzen Skill-Ordner als ZIP (Struktur: flashy-flashcards/…). */
skillRouter.get("/flashcards.zip", async (_req, res) => {
  if (!fs.existsSync(skillDir)) {
    res.status(404).json({ error: "Skill nicht gefunden" });
    return;
  }
  const zip = new JSZip();
  for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    zip.file(`${SKILL_NAME}/${entry.name}`, fs.readFileSync(path.join(skillDir, entry.name)));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${SKILL_NAME}.zip"`);
  res.send(buffer);
});
