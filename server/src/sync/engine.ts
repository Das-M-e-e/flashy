import fs from "node:fs";
import * as db from "../db";
import type { ConflictInfo, Snapshot, SnapshotSummary, SyncStatus } from "../types";
import * as github from "./github";
import { exportSnapshot, importSnapshot, parseSnapshot, summarize } from "./snapshot";

/** Im Konflikt-Fall persistierter Stand -- genau der, den der Nutzer im Popup sieht. */
interface PendingConflict {
  remoteSha: string;
  remoteSnapshot: Snapshot;
  local: SnapshotSummary;
  remote: SnapshotSummary;
}

let syncing = false;
let timer: NodeJS.Timeout | null = null;

function isConfigured(config: db.SyncConfigRow): boolean {
  return Boolean(config.token && config.owner && config.repo && config.branch);
}

export function isDirty(): boolean {
  const state = db.getSyncState();
  return state.revision !== state.syncedRevision;
}

function readConflict(): PendingConflict | null {
  const raw = db.getSyncState().pendingConflict;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingConflict;
  } catch {
    return null;
  }
}

function conflictInfo(conflict: PendingConflict): ConflictInfo {
  const newer =
    Date.parse(conflict.local.updatedAt) >= Date.parse(conflict.remote.updatedAt) ? "local" : "remote";
  return { local: conflict.local, remote: conflict.remote, newer };
}

export function getStatus(): SyncStatus {
  const config = db.getSyncConfig();
  const state = db.getSyncState();
  const conflict = readConflict();

  let stateName: SyncStatus["state"];
  if (!isConfigured(config)) stateName = "disabled";
  else if (syncing) stateName = "syncing";
  else if (conflict) stateName = "conflict";
  else if (state.lastError) stateName = "error";
  else stateName = "idle";

  return {
    state: stateName,
    dirty: state.revision !== state.syncedRevision,
    lastSyncedAt: state.lastSyncedAt,
    error: state.lastError,
    conflict: conflict ? conflictInfo(conflict) : null,
    dataVersion: state.dataVersion,
  };
}

function commitMessage(deviceName: string): string {
  return `Flashy sync from ${deviceName}`;
}

/**
 * Lädt referenzierte Medien hoch, die im Repo noch fehlen. Medien sind
 * inhaltsadressiert und unveränderlich -> nur fehlende hochladen, nie ändern.
 * Muss VOR dem JSON-Push laufen, damit die Datei nie fehlende Medien referenziert.
 */
async function pushMedia(config: db.SyncConfigRow): Promise<void> {
  const referenced = db.referencedMediaRefs();
  if (referenced.size === 0) return;
  const entries = await github.listDir(config.token!, config.owner!, config.repo!, "media", config.branch!);
  const present = new Set(entries.map((e) => `media/${e.name}`));
  for (const ref of referenced) {
    if (present.has(ref)) continue;
    const parsed = db.parseMediaRef(ref);
    if (!parsed) continue;
    const filePath = db.mediaFilePath(parsed.hash, parsed.ext);
    if (!fs.existsSync(filePath)) continue;
    await github.putBinaryFile(
      config.token!,
      config.owner!,
      config.repo!,
      ref,
      config.branch!,
      fs.readFileSync(filePath),
      `Flashy media ${parsed.hash.slice(0, 8)}`
    );
  }
}

/** Lädt nach einem Import fehlende Medien nach (best effort, blockiert nie). */
async function pullMedia(config: db.SyncConfigRow): Promise<void> {
  for (const ref of db.referencedMediaRefs()) {
    const parsed = db.parseMediaRef(ref);
    if (!parsed || db.getMedia(parsed.hash)) continue;
    try {
      const bytes = await github.getRawBytes(config.token!, config.owner!, config.repo!, ref, config.branch!);
      if (bytes !== github.NOT_FOUND) db.saveMediaFromRef(ref, bytes);
    } catch {
      // Nächster Sync versucht es erneut.
    }
  }
}

/** Lädt den lokalen Stand hoch und markiert ihn als synchronisiert. */
async function push(config: db.SyncConfigRow, sha?: string): Promise<void> {
  await pushMedia(config);
  const revisionAtRead = db.getSyncState().revision;
  const snapshot = exportSnapshot();
  const newSha = await github.putFile(
    config.token!,
    config.owner!,
    config.repo!,
    config.path,
    config.branch!,
    JSON.stringify(snapshot, null, 2),
    commitMessage(snapshot.deviceName),
    sha
  );
  db.markSynced(revisionAtRead, newSha);
}

/** Übernimmt den Remote-Stand und markiert ihn als synchronisiert. */
async function applyRemote(config: db.SyncConfigRow, snapshot: Snapshot, sha: string): Promise<void> {
  importSnapshot(snapshot);
  db.markSynced(db.getSyncState().revision, sha);
  await pullMedia(config);
}

/**
 * Ein Sync-Durchlauf. Merged nie automatisch: divergieren beide Seiten,
 * wird ein Konflikt hinterlegt, den der Nutzer auflöst.
 */
export async function sync(): Promise<SyncStatus> {
  const config = db.getSyncConfig();
  if (!isConfigured(config)) return getStatus();
  if (syncing) return getStatus();
  if (readConflict()) return getStatus(); // erst auflösen lassen

  syncing = true;
  try {
    await runSync(config);
  } catch (err) {
    db.setSyncError(err instanceof Error ? err.message : String(err));
  } finally {
    syncing = false;
  }
  // Status erst nach Freigabe des Mutex bilden, sonst meldet er immer "syncing".
  return getStatus();
}

async function runSync(config: db.SyncConfigRow): Promise<void> {
  const state = db.getSyncState();
  const dirty = state.revision !== state.syncedRevision;

  const fetchRemote = () =>
    github.getFile(config.token!, config.owner!, config.repo!, config.path, config.branch!);

  const remote = await fetchRemote();

  // Remote-Datei existiert noch nicht -> erster Push.
  if (remote === github.NOT_FOUND) {
    await push(config);
    return;
  }

  if (remote.sha === state.remoteSha) {
    // Remote unverändert seit unserem letzten Sync.
    if (!dirty) {
      db.setSyncError(null);
      return;
    }
    try {
      await push(config, remote.sha);
      return;
    } catch (err) {
      if (!(err instanceof github.RemoteChangedError)) throw err;
      // Remote hat sich zwischen GET und PUT bewegt -> als Konflikt behandeln.
      const fresh = await fetchRemote();
      if (fresh === github.NOT_FOUND) throw err;
      recordConflict(fresh);
      return;
    }
  }

  // Remote hat sich bewegt.
  if (!dirty) {
    await applyRemote(config, parseSnapshot(remote.content), remote.sha);
    return;
  }

  recordConflict(remote);
}

function recordConflict(remote: github.RemoteFile): void {
  const remoteSnapshot = parseSnapshot(remote.content);
  const conflict: PendingConflict = {
    remoteSha: remote.sha,
    remoteSnapshot,
    local: summarize(exportSnapshot()),
    remote: summarize(remoteSnapshot),
  };
  db.setPendingConflict(JSON.stringify(conflict));
  db.setSyncError(null);
}

/** Löst einen hinterlegten Konflikt in die gewählte Richtung auf. */
export async function resolve(choice: "local" | "remote"): Promise<SyncStatus> {
  const conflict = readConflict();
  if (!conflict) return getStatus();
  const config = db.getSyncConfig();
  if (!isConfigured(config)) return getStatus();

  let remoteMovedOn = false;
  syncing = true;
  try {
    if (choice === "remote") {
      await applyRemote(config, conflict.remoteSnapshot, conflict.remoteSha);
    } else {
      // Lokalen Stand über den Remote-Stand schreiben, den der Nutzer gesehen hat.
      await push(config, conflict.remoteSha);
    }
    db.setPendingConflict(null);
  } catch (err) {
    if (err instanceof github.RemoteChangedError) {
      // Remote ist seit der Anzeige weitergelaufen -> Konflikt frisch erfassen.
      db.setPendingConflict(null);
      remoteMovedOn = true;
    } else {
      db.setSyncError(err instanceof Error ? err.message : String(err));
    }
  } finally {
    syncing = false;
  }

  // Erst nach Freigabe des Mutex, sonst würde sync() sofort abbrechen.
  return remoteMovedOn ? sync() : getStatus();
}

// ---------- Zeitsteuerung ----------

/** (Neu-)Startet den Intervall-Sync gemäß Konfiguration. */
export function rescheduleAutoSync(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const config = db.getSyncConfig();
  if (!isConfigured(config) || !config.autoSync) return;
  const minutes = Math.max(1, config.intervalMinutes);
  timer = setInterval(() => {
    void sync();
  }, minutes * 60_000);
  timer.unref?.();
}

/** Beim Beenden: ungesicherte Änderungen noch hochladen, aber nie hängen bleiben. */
export async function syncOnShutdown(timeoutMs = 8000): Promise<void> {
  const config = db.getSyncConfig();
  if (!isConfigured(config) || !isDirty()) return;
  console.log("Flashy: lokale Änderungen werden noch synchronisiert …");
  await Promise.race([sync(), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
