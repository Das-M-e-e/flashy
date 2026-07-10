import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import type { SyncStatus } from "./types";

const POLL_MS = 10_000;

interface SyncContextValue {
  status: SyncStatus | null;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  resolve: (choice: "local" | "remote") => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  // Erste gesehene dataVersion; steigt sie, wurden lokale Daten ersetzt.
  const baseDataVersion = useRef<number | null>(null);

  const apply = useCallback((next: SyncStatus) => {
    if (baseDataVersion.current === null) {
      baseDataVersion.current = next.dataVersion;
    } else if (next.dataVersion > baseDataVersion.current) {
      // Der Sync hat den lokalen Datenbestand ersetzt -> Ansicht neu laden.
      window.location.reload();
      return;
    }
    setStatus(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api.syncStatus());
    } catch {
      // Server nicht erreichbar -- beim nächsten Tick erneut versuchen.
    }
  }, [apply]);

  const syncNow = useCallback(async () => {
    setStatus((prev) => (prev ? { ...prev, state: "syncing" } : prev));
    try {
      apply(await api.syncNow());
    } catch {
      await refresh();
    }
  }, [apply, refresh]);

  const resolve = useCallback(
    async (choice: "local" | "remote") => {
      apply(await api.syncResolve(choice));
    },
    [apply]
  );

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <SyncContext.Provider value={{ status, refresh, syncNow, resolve }}>{children}</SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
