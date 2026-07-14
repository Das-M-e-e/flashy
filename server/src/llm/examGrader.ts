import * as db from "../db";
import type { ExamResult, ExamTask, ExamTaskResult } from "../types";
import * as llm from "./client";

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Multiple-Choice deterministisch bewerten (Antwort == korrekte Option). */
function gradeMc(task: ExamTask, answer: string): ExamTaskResult {
  const correct = task.expected ? norm(answer) === norm(task.expected) : false;
  return {
    taskId: task.id,
    awardedPoints: correct ? task.points : 0,
    maxPoints: task.points,
    comment: correct ? "Richtig." : task.expected ? `Richtige Antwort: ${task.expected}` : "Falsch.",
  };
}

function languageName(language: string): string {
  return language === "en" ? "English" : "German";
}

function buildMessages(
  tasks: ExamTask[],
  answers: Record<string, string>,
  mcResults: Map<string, ExamTaskResult>,
  language: string
): llm.ChatMessage[] {
  const system = [
    "Du bist ein fairer, wohlwollender aber korrekter Prüfer.",
    `Schreibe alle Kommentare und das Feedback in ${languageName(language)}.`,
    "Bewerte die FREITEXT-Antworten anhand der Musterlösung. Multiple-Choice-Aufgaben sind bereits bewertet -- übernimm deren Punkte unverändert.",
    "Antworte NUR mit gültigem JSON, ohne Codeblock:",
    '{ "taskResults": [ { "taskId": string, "awardedPoints": number, "comment": string } ], "feedback": string }',
    "Regeln:",
    "- awardedPoints zwischen 0 und den maxPoints der Aufgabe; Teilpunkte sind erlaubt.",
    "- comment: kurze Begründung der Punktevergabe.",
    "- feedback: 2-4 Sätze, welche Themen gut sitzen und wo Verbesserungspotenzial besteht.",
  ].join("\n");

  const lines = tasks.map((t) => {
    const answer = answers[t.id] ?? "(keine Antwort)";
    if (t.format === "mc") {
      const r = mcResults.get(t.id);
      return `[${t.id}] MULTIPLE CHOICE (bereits bewertet: ${r?.awardedPoints}/${t.points})\nFrage: ${t.prompt}\nGewählt: ${answer}\nKorrekt: ${t.expected ?? "-"}`;
    }
    return `[${t.id}] FREITEXT (max ${t.points} Punkte)\nAufgabe: ${t.prompt}\nMusterlösung: ${t.expected ?? "-"}\nAntwort des Studierenden: ${answer}`;
  });

  return [
    { role: "system", content: system },
    { role: "user", content: `Bewerte folgende Prüfung:\n\n${lines.join("\n\n")}` },
  ];
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Bewertung enthielt kein gültiges JSON");
  }
}

/**
 * Bewertet eine abgegebene Prüfung asynchron: MC deterministisch, Freitext per
 * LLM. Setzt Status `graded` (synchronisierbar) bzw. bei Fehler `submitted`.
 */
export async function gradeExam(examId: string): Promise<void> {
  const exam = db.getExam(examId);
  if (!exam || !exam.paper) return;
  try {
    const answers = exam.answers ?? {};
    const tasks = exam.paper.tasks;

    // MC vorab deterministisch bewerten.
    const mcResults = new Map<string, ExamTaskResult>();
    for (const t of tasks) {
      if (t.format === "mc") mcResults.set(t.id, gradeMc(t, answers[t.id] ?? ""));
    }

    const parsed = extractJson(
      await llm.chatCompletion(db.getLlmConfig(), {
        messages: buildMessages(tasks, answers, mcResults, exam.config.language),
        maxTokens: 3000,
        responseFormat: { type: "json_object" },
      })
    ) as { taskResults?: unknown[]; feedback?: unknown };

    // LLM-Bewertungen der Freitextaufgaben einlesen.
    const llmResults = new Map<string, { awardedPoints: number; comment: string }>();
    if (Array.isArray(parsed.taskResults)) {
      for (const raw of parsed.taskResults) {
        const r = raw as Record<string, unknown>;
        const id = String(r.taskId ?? "");
        if (id) {
          llmResults.set(id, {
            awardedPoints: Number(r.awardedPoints) || 0,
            comment: typeof r.comment === "string" ? r.comment : "",
          });
        }
      }
    }

    const taskResults: ExamTaskResult[] = tasks.map((t) => {
      if (t.format === "mc") return mcResults.get(t.id)!;
      const r = llmResults.get(t.id);
      return {
        taskId: t.id,
        awardedPoints: Math.max(0, Math.min(t.points, r?.awardedPoints ?? 0)),
        maxPoints: t.points,
        comment: r?.comment ?? "Nicht bewertet.",
      };
    });

    const result: ExamResult = {
      taskResults,
      totalAwarded: taskResults.reduce((s, r) => s + r.awardedPoints, 0),
      totalPoints: taskResults.reduce((s, r) => s + r.maxPoints, 0),
      feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    };

    // Bewertete Prüfung ist Teil der Historie -> synchronisieren.
    db.updateExam(examId, { status: "graded", result, error: null }, { sync: true });
  } catch (err) {
    // Zurück auf "submitted" -- Antworten bleiben erhalten, Bewertung kann erneut angestoßen werden.
    db.updateExam(examId, {
      status: "submitted",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
