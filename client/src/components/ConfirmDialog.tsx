import { useLocale } from "../i18n";

interface Props {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Beschriftung des Bestätigen-Buttons (Vorgabe: „Löschen"). */
  confirmLabel?: string;
  /** Bestätigen als Gefahr-Aktion darstellen (Vorgabe: ja). */
  danger?: boolean;
}

export default function ConfirmDialog({ message, onCancel, onConfirm, confirmLabel, danger = true }: Props) {
  const { t } = useLocale();
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        // Bei verschachtelten Dialogen (z.B. innerhalb der Einstellungen) darf der
        // Klick nicht bis zum äußeren Overlay durchschlagen und dieses mitschließen.
        e.stopPropagation();
        onCancel();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0 }}>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>{t("common.cancel")}</button>
          <button className={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel ?? t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
