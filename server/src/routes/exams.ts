import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import * as db from "../db";
import { generateExam } from "../llm/examGenerator";
import { gradeExam } from "../llm/examGrader";
import * as llm from "../llm/client";
import type { Exam, ExamConfig } from "../types";

export const examsRouter = Router();
export const projectExamsRouter = Router({ mergeParams: true });
export const deckExamsRouter = Router({ mergeParams: true });

type ProjectParams = Request<{ projectId: string }>;
type DeckParams = Request<{ deckId: string }>;
type IdParams = Request<{ id: string }>;

/** Antwort-Map robust einlesen (nur String-Werte). */
function parseAnswers(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[String(k)] = typeof v === "string" ? v : String(v ?? "");
    }
  }
  return out;
}

/** Entfernt Musterlösungen, solange die Prüfung nicht bewertet ist. */
function publicExam(exam: Exam): Exam {
  if (exam.status === "graded" || !exam.paper) return exam;
  return {
    ...exam,
    paper: {
      ...exam.paper,
      tasks: exam.paper.tasks.map(({ expected, ...rest }) => rest),
    },
  };
}

/** Baut eine ExamConfig aus dem Request-Body mit robusten Defaults. */
function parseConfig(body: unknown, deckId: string | null): ExamConfig {
  const c = (body as { config?: Record<string, unknown> })?.config ?? {};
  const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const clamp01 = (v: unknown) => Math.min(1, Math.max(0, num(v, 0)));
  const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

  const deckIds = deckId ? [deckId] : strList(c.deckIds);
  const topics = Array.isArray(c.topics)
    ? c.topics.map((tp) => {
        const t = tp as Record<string, unknown>;
        return {
          deckId: String(t.deckId ?? ""),
          name: String(t.name ?? ""),
          points: t.points == null ? null : num(t.points, 0),
        };
      })
    : [];

  return {
    deckIds,
    cardIds: Array.isArray(c.cardIds) ? strList(c.cardIds) : null,
    topics,
    transferRatio: clamp01(c.transferRatio),
    directCardIds: strList(c.directCardIds),
    answerFormat: c.answerFormat === "mc" || c.answerFormat === "mixed" ? c.answerFormat : "text",
    mcRatio: clamp01(c.mcRatio),
    durationSeconds: Math.max(60, num(c.durationSeconds, 3600)),
    totalPoints: Math.max(1, num(c.totalPoints, 100)),
    perTopicPoints: Boolean(c.perTopicPoints),
    subject: String(c.subject ?? ""),
    allowedAids: String(c.allowedAids ?? ""),
    language: c.language === "en" ? "en" : c.language === "de" ? "de" : "auto",
  };
}

function createExam(projectId: string, deckId: string | null, body: unknown, res: Response): void {
  if (!db.getProject(projectId)) {
    res.status(404).json({ error: "Projekt nicht gefunden" });
    return;
  }
  if (!llm.isConfigured(db.getLlmConfig())) {
    res.status(400).json({ error: "Keine KI-Anbindung konfiguriert" });
    return;
  }
  const config = parseConfig(body, deckId);
  if (config.deckIds.length === 0) {
    res.status(400).json({ error: "Bitte mindestens ein Thema/Stapel wählen" });
    return;
  }
  const title = String((body as { title?: unknown })?.title ?? "").trim() || "Probeklausur";
  const exam = db.createExam({
    id: crypto.randomUUID(),
    projectId,
    deckId,
    title,
    status: "generating",
    config,
    durationSeconds: config.durationSeconds,
  });
  // Generierung im Hintergrund; der Client pollt den Status.
  void generateExam(exam.id);
  res.status(201).json(publicExam(exam));
}

projectExamsRouter.get("/", (req: ProjectParams, res) => {
  res.json(db.listExamsByProject(req.params.projectId).map(publicExam));
});

projectExamsRouter.post("/", (req: ProjectParams, res) => {
  createExam(req.params.projectId, null, req.body, res);
});

deckExamsRouter.get("/", (req: DeckParams, res) => {
  res.json(db.listExamsByDeck(req.params.deckId).map(publicExam));
});

deckExamsRouter.post("/", (req: DeckParams, res) => {
  const deck = db.getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: "Stapel nicht gefunden" });
    return;
  }
  createExam(deck.projectId, deck.id, req.body, res);
});

examsRouter.get("/:id", (req, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    res.status(404).json({ error: "Prüfung nicht gefunden" });
    return;
  }
  res.json(publicExam(exam));
});

examsRouter.post("/:id/start", (req: IdParams, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    res.status(404).json({ error: "Prüfung nicht gefunden" });
    return;
  }
  if (exam.status !== "ready" && exam.status !== "in_progress") {
    res.status(409).json({ error: "Prüfung ist nicht startbereit" });
    return;
  }
  if (exam.status === "ready") {
    const cfg = db.getSyncConfig();
    db.updateExam(exam.id, {
      status: "in_progress",
      startedAt: db.nowIso(),
      boundDevice: cfg.deviceName ?? db.defaultDeviceName(),
    });
  }
  res.json(publicExam(db.getExam(exam.id)!));
});

examsRouter.put("/:id/answers", (req: IdParams, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    res.status(404).json({ error: "Prüfung nicht gefunden" });
    return;
  }
  if (exam.status !== "in_progress") {
    res.status(409).json({ error: "Prüfung wird nicht bearbeitet" });
    return;
  }
  db.updateExam(exam.id, { answers: parseAnswers((req.body as { answers?: unknown })?.answers) });
  res.json({ ok: true });
});

examsRouter.post("/:id/submit", (req: IdParams, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    res.status(404).json({ error: "Prüfung nicht gefunden" });
    return;
  }
  if (exam.status !== "in_progress") {
    res.status(409).json({ error: "Prüfung wird nicht bearbeitet" });
    return;
  }
  const body = req.body as { answers?: unknown };
  const answers = body?.answers !== undefined ? parseAnswers(body.answers) : exam.answers;
  db.updateExam(exam.id, { status: "grading", answers });
  // Bewertung im Hintergrund; der Client pollt den Status.
  void gradeExam(exam.id);
  res.json(publicExam(db.getExam(exam.id)!));
});

/** Bewertung erneut anstoßen (nach Fehler oder Abbruch). */
examsRouter.post("/:id/grade", (req: IdParams, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    res.status(404).json({ error: "Prüfung nicht gefunden" });
    return;
  }
  if (exam.status !== "submitted" && exam.status !== "error") {
    res.status(409).json({ error: "Prüfung ist nicht zur Bewertung bereit" });
    return;
  }
  if (!exam.paper) {
    res.status(409).json({ error: "Keine Prüfung zum Bewerten vorhanden" });
    return;
  }
  db.updateExam(exam.id, { status: "grading", error: null });
  void gradeExam(exam.id);
  res.json(publicExam(db.getExam(exam.id)!));
});

examsRouter.delete("/:id", (req, res) => {
  db.deleteExam(req.params.id);
  res.status(204).end();
});
