import { useState } from "react";
import { useLocale } from "../i18n";
import { useSync } from "../sync";
import type { ConflictInfo, SnapshotSummary } from "../types";

function Side({
  title,
  summary,
  isNewer,
}: {
  title: string;
  summary: SnapshotSummary;
  isNewer: boolean;
}) {
  const { t, lang } = useLocale();
  const time = new Date(summary.updatedAt).toLocaleString(lang === "de" ? "de-DE" : "en-US");
  return (
    <div className={`conflict-side ${isNewer ? "conflict-side-newer" : ""}`}>
      <div className="conflict-side-head">
        <strong>{title}</strong>
        {isNewer && <span className="badge bi">{t("sync.conflict.newer")}</span>}
      </div>
      <div className="mastery-caption">{t("sync.conflict.device", { name: summary.deviceName })}</div>
      <div className="mastery-caption">{t("sync.conflict.changed", { time })}</div>
      <div className="mastery-caption">
        {t("sync.conflict.counts", {
          projects: summary.counts.projects,
          decks: summary.counts.decks,
          cards: summary.counts.cards,
        })}
      </div>
    </div>
  );
}

export default function SyncConflictDialog({
  conflict,
  onClose,
}: {
  conflict: ConflictInfo;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { resolve } = useSync();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(choice: "local" | "remote") {
    setBusy(true);
    setError(null);
    try {
      await resolve(choice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{t("sync.conflict.title")}</h3>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t("sync.conflict.intro")}</p>
        {error && <div className="error-banner">{error}</div>}

        <div className="conflict-grid">
          <Side
            title={t("sync.conflict.local")}
            summary={conflict.local}
            isNewer={conflict.newer === "local"}
          />
          <Side
            title={t("sync.conflict.remote")}
            summary={conflict.remote}
            isNewer={conflict.newer === "remote"}
          />
        </div>

        <div className="modal-actions sync-actions">
          <button onClick={onClose} disabled={busy}>
            {t("sync.conflict.later")}
          </button>
          <span className="spacer" />
          <button onClick={() => choose("remote")} disabled={busy}>
            {t("sync.conflict.keepRemote")}
          </button>
          <button className="primary" onClick={() => choose("local")} disabled={busy}>
            {t("sync.conflict.keepLocal")}
          </button>
        </div>
      </div>
    </div>
  );
}
