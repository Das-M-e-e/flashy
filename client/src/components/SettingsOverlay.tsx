import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import { useTheme } from "../theme";
import AiSettingsPanel from "./AiSettingsPanel";
import ConfirmDialog from "./ConfirmDialog";
import GeneralSettingsPanel from "./GeneralSettingsPanel";
import SyncSettingsPanel from "./SyncSettingsPanel";

export type SettingsTab = "general" | "sync" | "ai";

interface Props {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
}

/** Zentrales Einstellungsfenster: Tabs links, passendes Panel rechts. */
export default function SettingsOverlay({ tab, onTabChange, onClose }: Props) {
  const { t } = useLocale();
  const theme = useTheme();
  const locale = useLocale();

  const [activeDirty, setActiveDirty] = useState(false);
  const [confirmUnsavedChanges, setConfirmUnsavedChanges] = useState(true);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .generalConfig()
      .then((cfg) => setConfirmUnsavedChanges(cfg.confirmUnsavedChanges))
      .catch(() => {});
  }, []);

  // Der Inhalts-Container bleibt beim Tab-Wechsel dasselbe DOM-Element (nur die
  // Kinder wechseln) -- ohne das hier zurückzusetzen bliebe die Scrollposition
  // des vorherigen Tabs stehen.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  // Verwirft die Live-Vorschau des "Allgemein"-Tabs (Design/Sprache) -- Sync/AI
  // halten ihren Entwurf rein lokal, das Verwerfen erledigt dort das Unmounten.
  function discardActivePreview() {
    if (tab === "general") {
      theme.revert();
      locale.revert();
    }
    setActiveDirty(false);
  }

  function guardedRun(action: () => void) {
    if (activeDirty && confirmUnsavedChanges) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  function handleTabChange(next: SettingsTab) {
    if (next === tab) return;
    guardedRun(() => {
      discardActivePreview();
      onTabChange(next);
    });
  }

  function handleClose() {
    guardedRun(() => {
      discardActivePreview();
      onClose();
    });
  }

  function confirmDiscard() {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-sidebar">
          <button className={tab === "general" ? "active" : ""} onClick={() => handleTabChange("general")}>
            {t("general.title")}
          </button>
          <button className={tab === "sync" ? "active" : ""} onClick={() => handleTabChange("sync")}>
            {t("sync.title")}
          </button>
          <button className={tab === "ai" ? "active" : ""} onClick={() => handleTabChange("ai")}>
            {t("llm.title")}
          </button>
        </nav>
        <div className="settings-content" ref={contentRef}>
          <button className="settings-close" onClick={handleClose} aria-label={t("common.cancel")}>
            ×
          </button>
          {tab === "general" && (
            <GeneralSettingsPanel
              confirmUnsavedChanges={confirmUnsavedChanges}
              onConfirmUnsavedChangesSaved={setConfirmUnsavedChanges}
              onDirtyChange={setActiveDirty}
            />
          )}
          {tab === "sync" && <SyncSettingsPanel onDirtyChange={setActiveDirty} />}
          {tab === "ai" && <AiSettingsPanel onDirtyChange={setActiveDirty} />}
        </div>
      </div>

      {pendingAction && (
        <ConfirmDialog
          message={t("general.discardMessage")}
          confirmLabel={t("general.discardConfirm")}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmDiscard}
        />
      )}
    </div>
  );
}
