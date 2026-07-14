import * as db from "../db";
import type { Card, Deck, Exam, Project, Snapshot, SnapshotSummary } from "../types";

export const FORMAT_VERSION = 3;

/** Serialisiert den gesamten lokalen Datenbestand inklusive Lernstatistiken. */
export function exportSnapshot(): Snapshot {
  const projects = db.listProjects();
  const decks: Deck[] = [];
  const cards: Card[] = [];
  for (const project of projects) {
    for (const deck of db.listDecksByProject(project.id)) {
      decks.push(deck);
      cards.push(...db.listCardsByDeck(deck.id));
    }
  }
  // Nur bewertete Prüfungen wandern in die Historie; laufende bleiben lokal.
  const exams = db.listAllExams().filter((e) => db.isSyncableExamStatus(e.status));
  const config = db.getSyncConfig();
  return {
    formatVersion: FORMAT_VERSION,
    deviceName: config.deviceName ?? db.defaultDeviceName(),
    updatedAt: db.nowIso(),
    counts: { projects: projects.length, decks: decks.length, cards: cards.length },
    data: { projects, decks, cards, exams },
  };
}

export function summarize(snapshot: Snapshot): SnapshotSummary {
  return {
    deviceName: snapshot.deviceName,
    updatedAt: snapshot.updatedAt,
    counts: snapshot.counts,
  };
}

export function parseSnapshot(raw: string): Snapshot {
  const parsed = JSON.parse(raw) as Snapshot;
  if (typeof parsed !== "object" || parsed === null || !parsed.data) {
    throw new Error("Ungültige Sync-Datei: 'data' fehlt");
  }
  if (parsed.formatVersion > FORMAT_VERSION) {
    throw new Error(
      `Sync-Datei hat Format-Version ${parsed.formatVersion}, diese App versteht nur bis ${FORMAT_VERSION}. Bitte Flashy aktualisieren.`
    );
  }
  const { projects, decks, cards } = parsed.data;
  if (!Array.isArray(projects) || !Array.isArray(decks) || !Array.isArray(cards)) {
    throw new Error("Ungültige Sync-Datei: projects/decks/cards müssen Listen sein");
  }
  return parsed;
}

function insertExamRow(
  stmt: ReturnType<typeof db.db.prepare>,
  exam: Exam,
  deckExists: (id: string | null) => boolean
): void {
  stmt.run(
    exam.id,
    exam.projectId,
    deckExists(exam.deckId) ? exam.deckId : null,
    exam.title,
    exam.status,
    JSON.stringify(exam.config ?? {}),
    exam.paper ? JSON.stringify(exam.paper) : null,
    exam.answers ? JSON.stringify(exam.answers) : null,
    exam.result ? JSON.stringify(exam.result) : null,
    exam.boundDevice ?? null,
    exam.startedAt ?? null,
    exam.durationSeconds ?? 0,
    exam.error ?? null,
    exam.createdAt,
    exam.updatedAt
  );
}

/**
 * Ersetzt den lokalen Datenbestand vollständig durch die Momentaufnahme.
 * IDs, Zeitstempel und Lernzähler werden unverändert übernommen. Lokale, noch
 * nicht bewertete Prüfungen (z.B. eine laufende) werden bewahrt, solange ihr
 * Projekt im neuen Stand noch existiert.
 */
export function importSnapshot(snapshot: Snapshot): void {
  const { projects, decks, cards } = snapshot.data;
  const remoteExams = snapshot.data.exams ?? [];

  // Lokale, nicht-synchronisierte Prüfungen vor dem Löschen sichern.
  const localExams = db.listAllExams().filter((e) => !db.isSyncableExamStatus(e.status));

  const projectIds = new Set(projects.map((p) => p.id));
  const deckIds = new Set(decks.map((d) => d.id));
  const deckExists = (id: string | null) => id != null && deckIds.has(id);

  db.db.exec("BEGIN");
  try {
    // Foreign-Key-Cascade räumt decks -> cards -> card_stats -> exams mit ab.
    db.db.exec("DELETE FROM projects");

    const insertProject = db.db.prepare("INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)");
    for (const p of projects as Project[]) {
      insertProject.run(p.id, p.name, p.createdAt);
    }

    const insertDeck = db.db.prepare(
      "INSERT INTO decks (id, project_id, name, created_at) VALUES (?, ?, ?, ?)"
    );
    for (const d of decks as Deck[]) {
      insertDeck.run(d.id, d.projectId, d.name, d.createdAt);
    }

    const insertCard = db.db.prepare(
      `INSERT INTO cards (id, deck_id, front, back, bidirectional, type, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertStat = db.db.prepare(
      `INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count)
       VALUES (?, ?, ?, ?)`
    );
    for (const c of cards as Card[]) {
      const type = c.type ?? "basic";
      const data = c.data && Object.keys(c.data).length > 0 ? JSON.stringify(c.data) : null;
      insertCard.run(
        c.id,
        c.deckId,
        c.front,
        c.back,
        c.bidirectional ? 1 : 0,
        type,
        data,
        c.createdAt,
        c.updatedAt
      );
      for (const stat of c.stats ?? []) {
        insertStat.run(c.id, stat.direction, stat.correctCount, stat.incorrectCount);
      }
    }

    const insertExam = db.db.prepare(
      `INSERT INTO exams (id, project_id, deck_id, title, status, config, paper, answers, result,
         bound_device, started_at, duration_seconds, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // Bewertete Prüfungen aus dem Remote-Stand.
    for (const exam of remoteExams as Exam[]) {
      if (!projectIds.has(exam.projectId)) continue;
      insertExamRow(insertExam, exam, deckExists);
    }
    // Lokale, laufende Prüfungen bewahren, sofern ihr Projekt noch existiert.
    for (const exam of localExams) {
      if (!projectIds.has(exam.projectId)) continue;
      insertExamRow(insertExam, exam, deckExists);
    }

    db.db.exec("COMMIT");
  } catch (err) {
    db.db.exec("ROLLBACK");
    throw err;
  }

  db.bumpDataVersion();
}
