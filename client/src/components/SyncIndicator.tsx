import { useLocale } from "../i18n";
import { useSync } from "../sync";
import type { SyncStatus } from "../types";

/** Der angezeigte Zustand: "dirty" ist kein Server-Zustand, sondern idle + lokale Änderungen. */
function visualState(status: SyncStatus | null): string {
  if (!status) return "disabled";
  if (status.state === "idle" && status.dirty) return "dirty";
  return status.state;
}

export default function SyncIndicator({ onOpen }: { onOpen: () => void }) {
  const { t, lang } = useLocale();
  const { status } = useSync();
  const state = visualState(status);

  const label = t(`sync.state.${state}` as "sync.state.idle");
  const time = status?.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleTimeString(lang === "de" ? "de-DE" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const title = time ? `${label} — ${t("sync.lastSynced", { time })}` : `${label} — ${t("sync.never")}`;

  return (
    <button className="sync-indicator" onClick={onOpen} title={title} aria-label={t("sync.open")}>
      <span className={`sync-dot sync-dot-${state}`} />
      <span className="sync-indicator-label">{label}</span>
    </button>
  );
}
