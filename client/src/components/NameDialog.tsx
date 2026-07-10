import { useState, type ReactNode } from "react";
import { useLocale } from "../i18n";

interface Props {
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  /** Optional zusätzliche Felder für spätere Einstellungen. */
  children?: ReactNode;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

export default function NameDialog({
  title,
  label,
  placeholder,
  initialValue = "",
  submitLabel,
  children,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useLocale();
  const [name, setName] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError(t("dialog.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {error && <div className="error-banner">{error}</div>}
        <label>
          {label}
          <input
            type="text"
            value={name}
            autoFocus
            placeholder={placeholder}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </label>
        {children}
        <div className="modal-actions">
          <button onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="primary" onClick={handleSubmit} disabled={saving}>
            {submitLabel ?? t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
