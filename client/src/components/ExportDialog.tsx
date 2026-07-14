import { useState } from "react";
import type { ExportOptions } from "../api";
import { useLocale } from "../i18n";
import type { CardType } from "../types";

type Format = ExportOptions["format"];

const FORMATS: Format[] = ["flashy", "genericJson", "anki", "quizlet", "csv"];
const ALL_TYPES: CardType[] = ["basic", "type_answer", "choice", "truefalse", "cloze"];
const FIELDS = ["type", "bidirectional", "level", "percent", "correct", "incorrect", "created", "updated"] as const;

/** Nur generische Formate erlauben freie Spalten-/Eigenschaftswahl. */
const FIELD_FORMATS: Format[] = ["genericJson", "csv"];

interface Props {
  title: string;
  /** Im Datenbestand vorkommende Kartentypen (Default: alle). */
  availableTypes?: CardType[];
  onCancel: () => void;
  onExport: (opts: ExportOptions) => Promise<void>;
}

export default function ExportDialog({ title, availableTypes, onCancel, onExport }: Props) {
  const { t } = useLocale();
  const types = availableTypes && availableTypes.length ? availableTypes : ALL_TYPES;

  const [format, setFormat] = useState<Format>("flashy");
  const [advanced, setAdvanced] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<CardType>>(new Set(types));
  const [fields, setFields] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldsEnabled = FIELD_FORMATS.includes(format);

  function toggleType(tp: CardType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(tp) ? next.delete(tp) : next.add(tp);
      return next;
    });
  }
  function toggleField(f: string) {
    setFields((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  async function handleExport() {
    if (selectedTypes.size === 0) {
      setError(t("export.needType"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const allSelected = types.every((tp) => selectedTypes.has(tp));
      await onExport({
        format,
        cardTypes: allSelected ? null : [...selectedTypes],
        fields: fieldsEnabled ? [...fields] : [],
      });
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {error && <div className="error-banner">{error}</div>}

        <label>
          {t("export.format")}
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`export.format.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <p className="sync-hint">{t(`export.hint.${format}`)}</p>

        <button type="button" className="export-advanced-toggle" onClick={() => setAdvanced((a) => !a)}>
          {advanced ? "▾ " : "▸ "}
          {t("export.advanced")}
        </button>

        {advanced && (
          <div className="export-advanced">
            <div className="export-group">
              <span className="md-field-label">{t("export.cardTypes")}</span>
              <div className="export-checks">
                {types.map((tp) => (
                  <label key={tp} className="checkbox-row">
                    <input type="checkbox" checked={selectedTypes.has(tp)} onChange={() => toggleType(tp)} />
                    {t(`card.type.${tp}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className={`export-group ${fieldsEnabled ? "" : "export-group-disabled"}`}>
              <span className="md-field-label">{t("export.fields")}</span>
              <p className="sync-hint">
                {fieldsEnabled ? t("export.fieldsNote") : t("export.fieldsUnavailable")}
              </p>
              <div className="export-checks">
                {FIELDS.map((f) => (
                  <label key={f} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={fields.has(f)}
                      disabled={!fieldsEnabled}
                      onChange={() => toggleField(f)}
                    />
                    {t(`export.field.${f}`)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button className="primary" onClick={handleExport} disabled={busy}>
            {t("export.run")}
          </button>
        </div>
      </div>
    </div>
  );
}
