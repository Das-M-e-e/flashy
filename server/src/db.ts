import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Card,
  CardData,
  CardStat,
  CardType,
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

export const mediaDir = path.join(dataDir, "media");
fs.mkdirSync(mediaDir, { recursive: true });

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
    type TEXT NOT NULL DEFAULT 'basic',
    data TEXT,
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

  CREATE TABLE IF NOT EXISTS media (
    hash TEXT PRIMARY KEY,
    ext TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
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

// Additive Spalten-Migrationen für DBs, die vor diesen Feldern angelegt wurden.
{
  const cols = allRows<{ name: string }>("PRAGMA table_info(cards)").map((c) => c.name);
  if (!cols.includes("type")) db.exec("ALTER TABLE cards ADD COLUMN type TEXT NOT NULL DEFAULT 'basic'");
  if (!cols.includes("data")) db.exec("ALTER TABLE cards ADD COLUMN data TEXT");
}

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
  type: string;
  data: string | null;
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
  let data: CardData | null = null;
  if (row.data) {
    try {
      data = JSON.parse(row.data) as CardData;
    } catch {
      data = null;
    }
  }
  return {
    id: row.id,
    deckId: row.deckId,
    front: row.front,
    back: row.back,
    bidirectional: row.bidirectional === 1,
    type: (row.type as CardType) ?? "basic",
    data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stats: statsForCard(row.id),
  };
}

const cardCols = "id, deck_id as deckId, front, back, bidirectional, type, data, created_at as createdAt, updated_at as updatedAt";
const cardSelect = `SELECT ${cardCols} FROM cards`;

export function listCardsByDeck(deckId: string): Card[] {
  const rows = allRows<CardRow>(`${cardSelect} WHERE deck_id = ? ORDER BY created_at ASC`, deckId);
  return rows.map(rowToCard);
}

export function listCardsByProject(projectId: string): Card[] {
  const rows = allRows<CardRow>(
    `SELECT cards.id, cards.deck_id as deckId, cards.front, cards.back, cards.bidirectional,
            cards.type, cards.data, cards.created_at as createdAt, cards.updated_at as updatedAt
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

export interface CardInput {
  front: string;
  back: string;
  bidirectional: boolean;
  type?: CardType;
  data?: CardData | null;
}

/** Nur der Basic-Typ ist bidirektional; alle anderen laufen einseitig. */
function effectiveBidirectional(input: CardInput): boolean {
  const type = input.type ?? "basic";
  return type === "basic" ? input.bidirectional : false;
}

function serializeData(data: CardData | null | undefined): string | null {
  return data && Object.keys(data).length > 0 ? JSON.stringify(data) : null;
}

export function createCard(id: string, deckId: string, input: CardInput): Card {
  const timestamp = nowIso();
  const type = input.type ?? "basic";
  const bidi = effectiveBidirectional(input);
  db.prepare(
    "INSERT INTO cards (id, deck_id, front, back, bidirectional, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, deckId, input.front, input.back, bidi ? 1 : 0, type, serializeData(input.data), timestamp, timestamp);
  ensureStatsRows(id, bidi);
  touch();
  return getCard(id)!;
}

export function updateCard(id: string, input: CardInput): Card | undefined {
  const type = input.type ?? "basic";
  const bidi = effectiveBidirectional(input);
  db.prepare(
    "UPDATE cards SET front = ?, back = ?, bidirectional = ?, type = ?, data = ?, updated_at = ? WHERE id = ?"
  ).run(input.front, input.back, bidi ? 1 : 0, type, serializeData(input.data), nowIso(), id);
  ensureStatsRows(id, bidi);
  touch();
  return getCard(id);
}

export function deleteCard(id: string): void {
  db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  touch();
}

/** Setzt Lernzähler beim Import (überschreibt vorhandene Werte der Richtung). */
export function setCardStatsRows(
  cardId: string,
  rows: { direction: Direction; correctCount: number; incorrectCount: number }[]
): void {
  for (const r of rows) {
    db.prepare(
      `INSERT INTO card_stats (card_id, direction, correct_count, incorrect_count)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(card_id, direction) DO UPDATE SET correct_count = excluded.correct_count, incorrect_count = excluded.incorrect_count`
    ).run(cardId, r.direction, Math.max(0, r.correctCount | 0), Math.max(0, r.incorrectCount | 0));
  }
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

// ---------- Medien (inhaltsadressiert) ----------

export interface MediaRow {
  hash: string;
  ext: string;
  mime: string;
  size: number;
}

export interface MediaMeta extends MediaRow {
  /** Kanonische, hostfreie Referenz, wie sie im Kartentext steht. */
  ref: string;
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "audio/x-m4a": "m4a",
};

const EXT_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime])
);

export function extForMime(mime: string, fallbackName?: string): string {
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  const dot = fallbackName?.lastIndexOf(".") ?? -1;
  if (fallbackName && dot >= 0) return fallbackName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return "bin";
}

export function mimeForExt(ext: string): string {
  return EXT_MIME[ext] ?? "application/octet-stream";
}

export function mediaRef(hash: string, ext: string): string {
  return `media/${hash}.${ext}`;
}

export function mediaFilePath(hash: string, ext: string): string {
  return path.join(mediaDir, `${hash}.${ext}`);
}

export function getMedia(hash: string): MediaRow | undefined {
  return getRow<MediaRow>("SELECT hash, ext, mime, size FROM media WHERE hash = ?", hash);
}

export function listMediaHashes(): Set<string> {
  const rows = allRows<{ hash: string }>("SELECT hash FROM media");
  return new Set(rows.map((r) => r.hash));
}

/** Legt Bytes inhaltsadressiert ab (idempotent, dedupliziert über den sha-256). */
export function saveMedia(bytes: Buffer, mime: string, ext: string): MediaMeta {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const existing = getMedia(hash);
  if (!existing) {
    fs.writeFileSync(mediaFilePath(hash, cleanExt), bytes);
    db.prepare("INSERT INTO media (hash, ext, mime, size, created_at) VALUES (?, ?, ?, ?, ?)").run(
      hash,
      cleanExt,
      mime,
      bytes.length,
      nowIso()
    );
    return { hash, ext: cleanExt, mime, size: bytes.length, ref: mediaRef(hash, cleanExt) };
  }
  return { ...existing, ref: mediaRef(existing.hash, existing.ext) };
}

/** Für den Sync-Pull: Bytes zu einer bekannten Referenz `media/<hash>.<ext>` ablegen. */
export function saveMediaFromRef(ref: string, bytes: Buffer): void {
  const parsed = parseMediaRef(ref);
  if (!parsed) return;
  const { hash, ext } = parsed;
  if (getMedia(hash)) return;
  fs.writeFileSync(mediaFilePath(hash, ext), bytes);
  db.prepare("INSERT INTO media (hash, ext, mime, size, created_at) VALUES (?, ?, ?, ?, ?)").run(
    hash,
    ext,
    mimeForExt(ext),
    bytes.length,
    nowIso()
  );
}

export function parseMediaRef(ref: string): { hash: string; ext: string } | null {
  const m = ref.match(/^media\/([a-f0-9]{64})\.([a-z0-9]+)$/i);
  return m ? { hash: m[1].toLowerCase(), ext: m[2].toLowerCase() } : null;
}

const MEDIA_REF_RE = /media\/[a-f0-9]{64}\.[a-z0-9]+/gi;

/** Sammelt alle in Karten referenzierten Medien-Referenzen. */
export function referencedMediaRefs(): Set<string> {
  const refs = new Set<string>();
  const rows = allRows<{ front: string; back: string; data: string | null }>(
    "SELECT front, back, data FROM cards"
  );
  for (const row of rows) {
    const haystack = `${row.front}\n${row.back}\n${row.data ?? ""}`;
    for (const match of haystack.matchAll(MEDIA_REF_RE)) refs.add(match[0].toLowerCase());
  }
  return refs;
}

const DATA_URI_RE = /data:(image|audio)\/([\w.+-]+);base64,([A-Za-z0-9+/=]+)/g;

/** Ersetzt in einem Text eingebettete data-URIs durch Medien-Referenzen. */
function embeddedToRefs(text: string): { text: string; changed: boolean } {
  let changed = false;
  const out = text.replace(DATA_URI_RE, (_all, kind: string, subtype: string, b64: string) => {
    const bytes = Buffer.from(b64, "base64");
    const mime = `${kind}/${subtype}`;
    const meta = saveMedia(bytes, mime, extForMime(mime));
    changed = true;
    return meta.ref;
  });
  return { text: out, changed };
}

/**
 * Einmalige Migration: wandelt eingebettete Bilder/Audio (data-URI) in
 * inhaltsadressierte Medien-Dateien um und ersetzt die Referenzen. Idempotent
 * (findet keine data-URIs mehr, sobald erledigt).
 */
export function migrateEmbeddedMedia(): void {
  const rows = allRows<{ id: string; front: string; back: string; data: string | null }>(
    "SELECT id, front, back, data FROM cards"
  );
  let migrated = 0;
  const update = db.prepare("UPDATE cards SET front = ?, back = ?, data = ? WHERE id = ?");
  for (const row of rows) {
    if (!row.front.includes("data:") && !row.back.includes("data:") && !(row.data ?? "").includes("data:")) {
      continue;
    }
    const front = embeddedToRefs(row.front);
    const back = embeddedToRefs(row.back);
    const data = row.data ? embeddedToRefs(row.data) : { text: null as string | null, changed: false };
    if (front.changed || back.changed || data.changed) {
      update.run(front.text, back.text, data.text, row.id);
      migrated++;
    }
  }
  if (migrated > 0) {
    touch();
    console.log(`Flashy: ${migrated} Karte(n) mit eingebetteten Medien migriert.`);
  }
}
