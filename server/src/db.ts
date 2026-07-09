import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Card, CardStat, Deck, DeckStats, Direction, Project } from "./types";

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "flashy.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    bidirectional INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS card_stats (
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('forward', 'backward')),
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, direction)
  );

  CREATE INDEX IF NOT EXISTS idx_decks_project ON decks(project_id);
  CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
  CREATE INDEX IF NOT EXISTS idx_card_stats_card ON card_stats(card_id);
`);

export function nowIso(): string {
  return new Date().toISOString();
}

type SqlParam = string | number | null;

function allRows<T>(sql: string, ...params: SqlParam[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

function getRow<T>(sql: string, ...params: SqlParam[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

// ---------- Projects ----------

export function listProjects(): Project[] {
  return allRows<Project>("SELECT id, name, created_at as createdAt FROM projects ORDER BY created_at ASC");
}

export function getProject(id: string): Project | undefined {
  return getRow<Project>("SELECT id, name, created_at as createdAt FROM projects WHERE id = ?", id);
}

export function createProject(id: string, name: string): Project {
  const createdAt = nowIso();
  db.prepare("INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)").run(id, name, createdAt);
  return { id, name, createdAt };
}

export function renameProject(id: string, name: string): void {
  db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, id);
}

export function deleteProject(id: string): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

// ---------- Decks ----------

export function listDecksByProject(projectId: string): Deck[] {
  return allRows<Deck>(
    "SELECT id, project_id as projectId, name, created_at as createdAt FROM decks WHERE project_id = ? ORDER BY created_at ASC",
    projectId
  );
}

export function getDeck(id: string): Deck | undefined {
  return getRow<Deck>(
    "SELECT id, project_id as projectId, name, created_at as createdAt FROM decks WHERE id = ?",
    id
  );
}

export function createDeck(id: string, projectId: string, name: string): Deck {
  const createdAt = nowIso();
  db.prepare("INSERT INTO decks (id, project_id, name, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    projectId,
    name,
    createdAt
  );
  return { id, projectId, name, createdAt };
}

export function renameDeck(id: string, name: string): void {
  db.prepare("UPDATE decks SET name = ? WHERE id = ?").run(name, id);
}

export function deleteDeck(id: string): void {
  db.prepare("DELETE FROM decks WHERE id = ?").run(id);
}

// ---------- Cards ----------

interface CardRow {
  id: string;
  deckId: string;
  front: string;
  back: string;
  bidirectional: number;
  createdAt: string;
  updatedAt: string;
}

function statsForCard(cardId: string): CardStat[] {
  return allRows<CardStat>(
    "SELECT direction, correct_count as correctCount, incorrect_count as incorrectCount FROM card_stats WHERE card_id = ? ORDER BY direction ASC",
    cardId
  );
}

function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deckId,
    front: row.front,
    back: row.back,
    bidirectional: row.bidirectional === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stats: statsForCard(row.id),
  };
}

const cardSelect =
  "SELECT id, deck_id as deckId, front, back, bidirectional, created_at as createdAt, updated_at as updatedAt FROM cards";

export function listCardsByDeck(deckId: string): Card[] {
  const rows = allRows<CardRow>(`${cardSelect} WHERE deck_id = ? ORDER BY created_at ASC`, deckId);
  return rows.map(rowToCard);
}

export function listCardsByProject(projectId: string): Card[] {
  const rows = allRows<CardRow>(
    `SELECT cards.id, cards.deck_id as deckId, cards.front, cards.back, cards.bidirectional,
            cards.created_at as createdAt, cards.updated_at as updatedAt
     FROM cards JOIN decks ON decks.id = cards.deck_id
     WHERE decks.project_id = ? ORDER BY cards.created_at ASC`,
    projectId
  );
  return rows.map(rowToCard);
}

export function getCard(id: string): Card | undefined {
  const row = getRow<CardRow>(`${cardSelect} WHERE id = ?`, id);
  return row ? rowToCard(row) : undefined;
}

function ensureStatsRows(cardId: string, bidirectional: boolean): void {
  db.prepare(
    "INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count) VALUES (?, 'forward', 0, 0) ON CONFLICT(card_id, direction) DO NOTHING"
  ).run(cardId);
  if (bidirectional) {
    db.prepare(
      "INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count) VALUES (?, 'backward', 0, 0) ON CONFLICT(card_id, direction) DO NOTHING"
    ).run(cardId);
  } else {
    db.prepare("DELETE FROM card_stats WHERE card_id = ? AND direction = 'backward'").run(cardId);
  }
}

export function createCard(
  id: string,
  deckId: string,
  front: string,
  back: string,
  bidirectional: boolean
): Card {
  const timestamp = nowIso();
  db.prepare(
    "INSERT INTO cards (id, deck_id, front, back, bidirectional, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, deckId, front, back, bidirectional ? 1 : 0, timestamp, timestamp);
  ensureStatsRows(id, bidirectional);
  return getCard(id)!;
}

export function updateCard(
  id: string,
  front: string,
  back: string,
  bidirectional: boolean
): Card | undefined {
  db.prepare("UPDATE cards SET front = ?, back = ?, bidirectional = ?, updated_at = ? WHERE id = ?").run(
    front,
    back,
    bidirectional ? 1 : 0,
    nowIso(),
    id
  );
  ensureStatsRows(id, bidirectional);
  return getCard(id);
}

export function deleteCard(id: string): void {
  db.prepare("DELETE FROM cards WHERE id = ?").run(id);
}

export function recordAnswer(cardId: string, direction: Direction, correct: boolean): void {
  const column = correct ? "correct_count" : "incorrect_count";
  db.prepare(
    `INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(card_id, direction) DO UPDATE SET ${column} = ${column} + 1`
  ).run(cardId, direction, correct ? 1 : 0, correct ? 0 : 1);
}

// ---------- Mastery ----------

const MASTERY_CAP = 5;

export function computeMastery(cards: Card[]): DeckStats {
  const items = cards.flatMap((card) => card.stats);
  if (items.length === 0) {
    return { deckId: "", itemCount: 0, masteryPercent: 0, masteryLabel: "keine Karten" };
  }
  const total = items.reduce((sum, stat) => {
    const level = Math.max(0, stat.correctCount - stat.incorrectCount);
    return sum + Math.min(level, MASTERY_CAP) / MASTERY_CAP;
  }, 0);
  const masteryPercent = Math.round((total / items.length) * 100);
  let masteryLabel: DeckStats["masteryLabel"];
  if (masteryPercent < 20) masteryLabel = "schwach";
  else if (masteryPercent < 50) masteryLabel = "mäßig";
  else if (masteryPercent < 80) masteryLabel = "gut";
  else masteryLabel = "sehr gut";
  return { deckId: "", itemCount: items.length, masteryPercent, masteryLabel };
}
