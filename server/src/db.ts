import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Card,
  CardStat,
  Deck,
  DeckStats,
  Direction,
  MasteryBuckets,
  MasteryLevel,
  MasterySummary,
  Project,
  ProjectStats,
} from "./types";

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
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

  CREATE TABLE IF NOT EXISTS sync_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    owner TEXT,
    repo TEXT,
    branch TEXT,
    path TEXT NOT NULL DEFAULT 'flashy-data.json',
    token TEXT,
    github_login TEXT,
    device_name TEXT,
    auto_sync INTEGER NOT NULL DEFAULT 1,
    interval_minutes INTEGER NOT NULL DEFAULT 5
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 0,
    synced_revision INTEGER NOT NULL DEFAULT 0,
    data_version INTEGER NOT NULL DEFAULT 0,
    remote_sha TEXT,
    last_synced_at TEXT,
    last_error TEXT,
    pending_conflict TEXT
  );
`);

// Beim allerersten Anlegen von sync_state gelten bereits vorhandene Daten als
// "lokal geändert" -- sonst würde der erste Sync sie stillschweigend durch den
// Remote-Stand ersetzen.
{
  const existing = getRow<{ id: number }>("SELECT id FROM sync_state WHERE id = 1");
  if (!existing) {
    const hasData = getRow<{ n: number }>("SELECT COUNT(*) as n FROM projects")!.n > 0;
    db.prepare(
      "INSERT INTO sync_state (id, revision, synced_revision, data_version) VALUES (1, ?, 0, 0)"
    ).run(hasData ? 1 : 0);
  }
  const config = getRow<{ id: number }>("SELECT id FROM sync_config WHERE id = 1");
  if (!config) {
    db.prepare(
      "INSERT INTO sync_config (id, path, device_name, auto_sync, interval_minutes) VALUES (1, 'flashy-data.json', ?, 1, 5)"
    ).run(os.hostname());
  }
}

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

// ---------- Änderungszähler ----------

/** Erhöht die lokale Revision. Aufzurufen bei jeder schreibenden Datenänderung. */
export function touch(): void {
  db.prepare("UPDATE sync_state SET revision = revision + 1 WHERE id = 1").run();
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
  touch();
  return { id, name, createdAt };
}

export function renameProject(id: string, name: string): void {
  db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, id);
  touch();
}

export function deleteProject(id: string): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  touch();
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
  touch();
  return { id, projectId, name, createdAt };
}

export function renameDeck(id: string, name: string): void {
  db.prepare("UPDATE decks SET name = ? WHERE id = ?").run(name, id);
  touch();
}

export function deleteDeck(id: string): void {
  db.prepare("DELETE FROM decks WHERE id = ?").run(id);
  touch();
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
  touch();
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
  touch();
  return getCard(id);
}

export function deleteCard(id: string): void {
  db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  touch();
}

export function recordAnswer(cardId: string, direction: Direction, correct: boolean): void {
  const column = correct ? "correct_count" : "incorrect_count";
  db.prepare(
    `INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(card_id, direction) DO UPDATE SET ${column} = ${column} + 1`
  ).run(cardId, direction, correct ? 1 : 0, correct ? 0 : 1);
  touch();
}

// ---------- Mastery ----------

const MASTERY_CAP = 5;

function levelOf(stat: CardStat): number {
  return Math.max(0, stat.correctCount - stat.incorrectCount);
}

function summarize(items: CardStat[]): MasterySummary {
  const buckets: MasteryBuckets = { new: 0, learning: 0, known: 0, mastered: 0 };
  if (items.length === 0) {
    return { itemCount: 0, masteryPercent: 0, masteryLabel: "empty", buckets };
  }
  let total = 0;
  for (const stat of items) {
    const level = levelOf(stat);
    total += Math.min(level, MASTERY_CAP) / MASTERY_CAP;
    if (level === 0) buckets.new += 1;
    else if (level <= 2) buckets.learning += 1;
    else if (level <= 4) buckets.known += 1;
    else buckets.mastered += 1;
  }
  const masteryPercent = Math.round((total / items.length) * 100);
  let masteryLabel: MasteryLevel;
  if (masteryPercent < 20) masteryLabel = "weak";
  else if (masteryPercent < 50) masteryLabel = "moderate";
  else if (masteryPercent < 80) masteryLabel = "good";
  else masteryLabel = "excellent";
  return { itemCount: items.length, masteryPercent, masteryLabel, buckets };
}

export function computeDeckStats(deckId: string): DeckStats {
  const items = listCardsByDeck(deckId).flatMap((card) => card.stats);
  return { deckId, ...summarize(items) };
}

export function computeProjectStats(projectId: string): ProjectStats {
  const decks = listDecksByProject(projectId);
  const cards = listCardsByProject(projectId);
  const items = cards.flatMap((card) => card.stats);
  return {
    projectId,
    deckCount: decks.length,
    cardCount: cards.length,
    ...summarize(items),
  };
}

// ---------- Sync-Konfiguration ----------

export interface SyncConfigRow {
  owner: string | null;
  repo: string | null;
  branch: string | null;
  path: string;
  token: string | null;
  githubLogin: string | null;
  deviceName: string | null;
  autoSync: number;
  intervalMinutes: number;
}

export function getSyncConfig(): SyncConfigRow {
  return getRow<SyncConfigRow>(
    `SELECT owner, repo, branch, path, token, github_login as githubLogin,
            device_name as deviceName, auto_sync as autoSync, interval_minutes as intervalMinutes
     FROM sync_config WHERE id = 1`
  )!;
}

export function setSyncToken(token: string | null, githubLogin: string | null): void {
  db.prepare("UPDATE sync_config SET token = ?, github_login = ? WHERE id = 1").run(token, githubLogin);
}

export function setSyncTarget(opts: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  deviceName: string;
  autoSync: boolean;
  intervalMinutes: number;
}): void {
  db.prepare(
    `UPDATE sync_config SET owner = ?, repo = ?, branch = ?, path = ?, device_name = ?,
            auto_sync = ?, interval_minutes = ? WHERE id = 1`
  ).run(
    opts.owner,
    opts.repo,
    opts.branch,
    opts.path,
    opts.deviceName,
    opts.autoSync ? 1 : 0,
    opts.intervalMinutes
  );
}

/** Löst die Verknüpfung: Token, Ziel-Repo und Sync-Zustand werden verworfen. */
export function clearSyncConfig(): void {
  db.prepare(
    `UPDATE sync_config SET owner = NULL, repo = NULL, branch = NULL, token = NULL,
            github_login = NULL, path = 'flashy-data.json' WHERE id = 1`
  ).run();
  db.prepare(
    `UPDATE sync_state SET synced_revision = 0, remote_sha = NULL, last_synced_at = NULL,
            last_error = NULL, pending_conflict = NULL WHERE id = 1`
  ).run();
}

// ---------- Sync-Zustand ----------

export interface SyncStateRow {
  revision: number;
  syncedRevision: number;
  dataVersion: number;
  remoteSha: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingConflict: string | null;
}

export function getSyncState(): SyncStateRow {
  return getRow<SyncStateRow>(
    `SELECT revision, synced_revision as syncedRevision, data_version as dataVersion,
            remote_sha as remoteSha, last_synced_at as lastSyncedAt,
            last_error as lastError, pending_conflict as pendingConflict
     FROM sync_state WHERE id = 1`
  )!;
}

/** Markiert den übergebenen Revisionsstand als erfolgreich synchronisiert. */
export function markSynced(revision: number, remoteSha: string): void {
  db.prepare(
    `UPDATE sync_state SET synced_revision = ?, remote_sha = ?, last_synced_at = ?,
            last_error = NULL, pending_conflict = NULL WHERE id = 1`
  ).run(revision, remoteSha, nowIso());
}

export function setSyncError(message: string | null): void {
  db.prepare("UPDATE sync_state SET last_error = ? WHERE id = 1").run(message);
}

export function setPendingConflict(payload: string | null): void {
  db.prepare("UPDATE sync_state SET pending_conflict = ? WHERE id = 1").run(payload);
}

/** Nach dem Übernehmen von Remote-Daten: Clients müssen neu laden. */
export function bumpDataVersion(): void {
  db.prepare("UPDATE sync_state SET data_version = data_version + 1 WHERE id = 1").run();
}

export function defaultDeviceName(): string {
  return os.hostname();
}
