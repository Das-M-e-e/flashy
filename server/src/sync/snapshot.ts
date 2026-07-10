import * as db from "../db";
import type { Card, Deck, Project, Snapshot, SnapshotSummary } from "../types";

export const FORMAT_VERSION = 1;

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
  const config = db.getSyncConfig();
  return {
    formatVersion: FORMAT_VERSION,
    deviceName: config.deviceName ?? db.defaultDeviceName(),
    updatedAt: db.nowIso(),
    counts: { projects: projects.length, decks: decks.length, cards: cards.length },
    data: { projects, decks, cards },
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

/**
 * Ersetzt den lokalen Datenbestand vollständig durch die Momentaufnahme.
 * IDs, Zeitstempel und Lernzähler werden unverändert übernommen.
 */
export function importSnapshot(snapshot: Snapshot): void {
  const { projects, decks, cards } = snapshot.data;

  db.db.exec("BEGIN");
  try {
    // Foreign-Key-Cascade räumt decks -> cards -> card_stats mit ab.
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
      `INSERT INTO cards (id, deck_id, front, back, bidirectional, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertStat = db.db.prepare(
      `INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count)
       VALUES (?, ?, ?, ?)`
    );
    for (const c of cards as Card[]) {
      insertCard.run(c.id, c.deckId, c.front, c.back, c.bidirectional ? 1 : 0, c.createdAt, c.updatedAt);
      for (const stat of c.stats ?? []) {
        insertStat.run(c.id, stat.direction, stat.correctCount, stat.incorrectCount);
      }
    }

    db.db.exec("COMMIT");
  } catch (err) {
    db.db.exec("ROLLBACK");
    throw err;
  }

  db.bumpDataVersion();
}
