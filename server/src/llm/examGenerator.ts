import crypto from "node:crypto";
import * as db from "../db";
import type { Card, ExamConfig, ExamPaper, ExamTask } from "../types";
import * as llm from "./client";

interface CardGroup {
  deckId: string;
  deckName: string;
  cards: Card[];
}

/** Sammelt die abgefragten Karten, gruppiert nach Stapel (= Thema). */
function gatherCards(config: ExamConfig): CardGroup[] {
  const selected = config.cardIds && config.cardIds.length > 0 ? new Set(config.cardIds) : null;
  const groups: CardGroup[] = [];
  for (const deckId of config.deckIds) {
    const deck = db.getDeck(deckId);
    if (!deck) continue;
    let cards = db.listCardsByDeck(deckId);
    if (selected) cards = cards.filter((c) => selected.has(c.id));
    if (cards.length > 0) groups.push({ deckId, deckName: deck.name, cards });
  }
  return groups;
}

/** Ersetzt Medien-Referenzen durch Platzhalter -- das LLM sieht keine Bilder. */
function stripMedia(text: string): string {
  return text
    .replace(/!?\[[^\]]*\]\(media\/[a-f0-9]{64}\.[a-z0-9]+\)/gi, "[Bild]")
    .replace(/media\/[a-f0-9]{64}\.[a-z0-9]+/gi, "[Medien]");
}

function cardToText(card: Card): string {
  const parts = [`- (${card.type}) F: ${stripMedia(card.front)} | A: ${stripMedia(card.back)}`];
  if (card.type === "choice" && card.data?.options) {
    const opts = card.data.options.map((o) => `${o.correct ? "✓" : "✗"} ${stripMedia(o.text)}`);
    parts.push(`  Optionen: ${opts.join(" / ")}`);
  }
  return parts.join("\n");
}

function languageName(config: ExamConfig): string {
  return config.language === "en" ? "English" : "German";
}

function buildMessages(config: ExamConfig, groups: CardGroup[]): llm.ChatMessage[] {
  const lang = languageName(config);
  const mcCount = groups.reduce(
    (n, g) => n + g.cards.filter((c) => c.type === "choice").length,
    0
  );

  const topicPoints = config.perTopicPoints
    ? config.topics
        .map((tp) => `  - "${tp.name}" (deckId ${tp.deckId}): ${tp.points ?? "auto"} Punkte`)
        .join("\n")
    : "gleichmäßig über die Aufgaben verteilen";

  const cardBlocks = groups
    .map((g) => `### Thema "${g.deckName}" (deckId: ${g.deckId})\n${g.cards.map(cardToText).join("\n")}`)
    .join("\n\n");

  const directHint =
    config.directCardIds.length > 0
      ? `Diese Karten-IDs sollen möglichst 1:1 direkt abgefragt werden: ${config.directCardIds.join(", ")}.`
      : "Keine Karten sind zur direkten 1:1-Abfrage markiert.";

  const answerFormatHint =
    config.answerFormat === "text"
      ? "Ausschließlich Freitext-Aufgaben (format \"text\")."
      : config.answerFormat === "mc"
        ? "Ausschließlich Multiple-Choice-Aufgaben (format \"mc\")."
        : `Mischung aus Freitext und Multiple Choice. MC-Anteil etwa ${Math.round(
            config.mcRatio * 100
          )} %.`;

  const system = [
    "Du bist ein erfahrener Prüfungsersteller.",
    `Erstelle eine schriftliche Probeklausur ausschließlich in ${lang}.`,
    "Antworte NUR mit gültigem JSON, ohne Markdown-Codeblock, ohne erklärenden Text.",
    "JSON-Schema:",
    '{ "tasks": [ { "topicDeckId": string|null, "format": "text"|"mc", "prompt": string, "options"?: string[], "expected": string, "points": number } ] }',
    "Regeln:",
    "- Die Summe aller task.points MUSS exakt der Gesamtpunktzahl entsprechen.",
    "- Bei MC-Aufgaben: options enthält 3-5 plausible Optionen; expected ist der exakte Text der richtigen Option. Bevorzuge vorhandene MC-Karten; sonst erzeuge sinnvolle Distraktoren.",
    "- Bei Freitext-Aufgaben: expected ist eine kompakte Musterlösung / Bewertungskriterien.",
    "- topicDeckId ist die deckId des zugehörigen Themas (oder null).",
    "- prompt ist die vollständige Aufgabenstellung für die Studierenden.",
  ].join("\n");

  const user = [
    `Fach: ${config.subject || "(unbenannt)"}`,
    `Gesamtpunktzahl: ${config.totalPoints}`,
    `Punkte pro Thema:\n${topicPoints}`,
    `Fragetyp-Mix: ${Math.round((1 - config.transferRatio) * 100)} % direkte Wissensabfrage, ${Math.round(
      config.transferRatio * 100
    )} % Transfer-/Anwendungsaufgaben.`,
    directHint,
    `Antwortformat: ${answerFormatHint}`,
    `Es liegen ${mcCount} echte Multiple-Choice-Karten in der Auswahl vor.`,
    "",
    "Karten nach Themen:",
    cardBlocks,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Extrahiert JSON aus einer Antwort, auch wenn ein Codeblock drumherum steht. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("LLM-Antwort enthielt kein gültiges JSON");
  }
}

function normalizeTasks(parsed: unknown): ExamTask[] {
  const rawTasks = (parsed as { tasks?: unknown[] })?.tasks;
  if (!Array.isArray(rawTasks)) throw new Error("LLM-Antwort ohne 'tasks'-Liste");
  const tasks: ExamTask[] = [];
  for (const raw of rawTasks) {
    const t = raw as Record<string, unknown>;
    const format = t.format === "mc" ? "mc" : "text";
    const prompt = typeof t.prompt === "string" ? t.prompt.trim() : "";
    if (!prompt) continue;
    const points = Math.max(0, Number(t.points) || 0);
    const options =
      format === "mc" && Array.isArray(t.options)
        ? t.options.map((o) => String(o)).filter((o) => o.trim().length > 0)
        : undefined;
    tasks.push({
      id: crypto.randomUUID(),
      topicDeckId: typeof t.topicDeckId === "string" ? t.topicDeckId : null,
      format,
      prompt,
      options,
      expected: typeof t.expected === "string" ? t.expected : "",
      points,
    });
  }
  if (tasks.length === 0) throw new Error("LLM lieferte keine verwertbaren Aufgaben");
  return tasks;
}

/**
 * Erstellt die Prüfung asynchron: ruft das LLM, parst das Ergebnis und setzt
 * den Status auf `ready` bzw. `error`. Wirft nie -- Fehler landen im Exam.
 */
export async function generateExam(examId: string): Promise<void> {
  const exam = db.getExam(examId);
  if (!exam) return;
  try {
    const config = exam.config;
    const groups = gatherCards(config);
    if (groups.length === 0) throw new Error("Keine Karten in der Auswahl");

    const content = await llm.chatCompletion(db.getLlmConfig(), {
      messages: buildMessages(config, groups),
      maxTokens: 4000,
      responseFormat: { type: "json_object" },
    });

    const tasks = normalizeTasks(extractJson(content));
    const paper: ExamPaper = {
      subject: config.subject,
      topicNames: groups.map((g) => g.deckName),
      totalPoints: tasks.reduce((sum, t) => sum + t.points, 0),
      durationSeconds: config.durationSeconds,
      allowedAids: config.allowedAids,
      tasks,
    };
    db.updateExam(examId, { status: "ready", paper, error: null });
  } catch (err) {
    db.updateExam(examId, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
