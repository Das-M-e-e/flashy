import { useEffect, useState } from "react";
import { api } from "../api";
import { useLocale, type Lang } from "../i18n";
import { useTheme } from "../theme";

interface Props {
  confirmUnsavedChanges: boolean;
  onConfirmUnsavedChangesSaved: (value: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export default function GeneralSettingsPanel({
  confirmUnsavedChanges,
  onConfirmUnsavedChangesSaved,
  onDirtyChange,
}: Props) {
  const { t } = useLocale();
  const theme = useTheme();
  const locale = useLocale();
  const [confirmDraft, setConfirmDraft] = useState(confirmUnsavedChanges);

  useEffect(() => {
    setConfirmDraft(confirmUnsavedChanges);
  }, [confirmUnsavedChanges]);

  const themeDirty = theme.mode !== theme.savedMode;
  const langDirty = locale.lang !== locale.savedLang;
  const confirmDirty = confirmDraft !== confirmUnsavedChanges;
  const isDirty = themeDirty || langDirty || confirmDirty;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const followsSystem = theme.mode === "system";

  function toggleFollowSystem(checked: boolean) {
    theme.preview(checked ? "system" : theme.theme);
  }

  function handleThemeSwitch(checked: boolean) {
    theme.preview(checked ? "dark" : "light");
  }

  function handleSave() {
    theme.commit();
    locale.commit();
    api.generalSaveConfig({ confirmUnsavedChanges: confirmDraft }).catch(() => {});
    onConfirmUnsavedChangesSaved(confirmDraft);
  }

  function handleCancel() {
    theme.revert();
    locale.revert();
    setConfirmDraft(confirmUnsavedChanges);
  }

  return (
    <>
      <h3>{t("general.title")}</h3>
      <p className="sync-hint">{t("general.intro")}</p>

      <section className="sync-section">
        <h4>{t("general.theme")}</h4>
        <div className="theme-switch-row">
          <span className={!followsSystem && theme.theme === "light" ? "theme-switch-label active" : "theme-switch-label"}>
            {t("general.themeLight")}
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={theme.theme === "dark"}
              disabled={followsSystem}
              onChange={(e) => handleThemeSwitch(e.target.checked)}
            />
            <span className="toggle-switch-track" />
          </label>
          <span className={!followsSystem && theme.theme === "dark" ? "theme-switch-label active" : "theme-switch-label"}>
            {t("general.themeDark")}
          </span>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={followsSystem} onChange={(e) => toggleFollowSystem(e.target.checked)} />
          {t("general.followSystem")}
        </label>
      </section>

      <section className="sync-section">
        <h4>{t("general.language")}</h4>
        <select value={locale.lang} onChange={(e) => locale.preview(e.target.value as Lang)}>
          <option value="de">{t("lang.de")}</option>
          <option value="en">{t("lang.en")}</option>
        </select>
      </section>

      <section className="sync-section">
        <label className="checkbox-row">
          <input type="checkbox" checked={confirmDraft} onChange={(e) => setConfirmDraft(e.target.checked)} />
          {t("general.confirmUnsaved")}
        </label>
      </section>

      {isDirty && (
        <div className="modal-actions sync-actions">
          <span className="spacer" />
          <button onClick={handleCancel}>{t("common.cancel")}</button>
          <button className="primary" onClick={handleSave}>
            {t("common.save")}
          </button>
        </div>
      )}
    </>
  );
}
