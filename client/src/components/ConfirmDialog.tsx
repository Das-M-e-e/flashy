import { useLocale } from "../i18n";

interface Props {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({ message, onCancel, onConfirm }: Props) {
  const { t } = useLocale();
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0 }}>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>{t("common.cancel")}</button>
          <button className="danger" onClick={onConfirm}>
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
