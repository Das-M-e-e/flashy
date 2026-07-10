import { useState } from "react";
import { useLocale } from "../i18n";
import type { Card } from "../types";
import MarkdownField from "./MarkdownField";

interface Props {
  initial?: Card;
  onCancel: () => void;
  onSave: (front: string, back: string, bidirectional: boolean) => Promise<void>;
}

export default function CardEditorModal({ initial, onCancel, onSave }: Props) {
  const { t } = useLocale();
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [bidirectional, setBidirectional] = useState(initial?.bidirectional ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!front.trim() || !back.trim()) {
      setError(t("card.emptyError"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(front.trim(), back.trim(), bidirectional);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? t("card.editTitle") : t("card.newTitle")}</h3>
        {error && <div className="error-banner">{error}</div>}
        <MarkdownField
          label={t("card.front")}
          value={front}
          autoFocus
          onChange={setFront}
          onError={setError}
        />
        <MarkdownField label={t("card.back")} value={back} onChange={setBack} onError={setError} />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={bidirectional}
            onChange={(e) => setBidirectional(e.target.checked)}
          />
          {t("card.bidirectionalOption")}
        </label>
        <div className="modal-actions">
          <button onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
