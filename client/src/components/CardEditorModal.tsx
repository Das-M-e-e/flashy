import { useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import type { Card, CardInput, CardType, ChoiceOption } from "../types";
import ExportDialog from "./ExportDialog";
import MarkdownField from "./MarkdownField";

interface Props {
  initial?: Card;
  onCancel: () => void;
  onSave: (input: CardInput) => Promise<void>;
}

const TYPES: CardType[] = ["basic", "type_answer", "choice", "truefalse", "cloze"];

export default function CardEditorModal({ initial, onCancel, onSave }: Props) {
  const { t } = useLocale();
  const [type, setType] = useState<CardType>(initial?.type ?? "basic");
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [bidirectional, setBidirectional] = useState(initial?.bidirectional ?? true);
  const [variants, setVariants] = useState((initial?.data?.answers ?? []).join("\n"));
  const [options, setOptions] = useState<ChoiceOption[]>(
    initial?.data?.options ?? [
      { text: "", correct: true },
      { text: "", correct: false },
    ]
  );
  const [multi, setMulti] = useState(initial?.data?.multi ?? false);
  const [tfAnswer, setTfAnswer] = useState(initial?.data?.answer ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  function buildInput(): CardInput | string {
    if (!front.trim()) return t("card.emptyError");
    switch (type) {
      case "basic":
        if (!back.trim()) return t("card.emptyError");
        return { type, front, back, bidirectional };
      case "type_answer": {
        if (!back.trim()) return t("card.emptyError");
        const answers = variants
          .split("\n")
          .map((a) => a.trim())
          .filter(Boolean);
        return { type, front, back, bidirectional: false, data: answers.length ? { answers } : {} };
      }
      case "choice": {
        const opts = options
          .map((o) => ({ text: o.text.trim(), correct: o.correct }))
          .filter((o) => o.text);
        if (opts.length < 2) return t("card.needTwoOptions");
        if (!opts.some((o) => o.correct)) return t("card.needCorrectOption");
        return { type, front, back, bidirectional: false, data: { options: opts, multi } };
      }
      case "truefalse":
        return { type, front, back: "", bidirectional: false, data: { answer: tfAnswer } };
      case "cloze":
        if (!/\{\{c\d+::/.test(front)) return t("card.needCloze");
        return { type, front, back, bidirectional: false };
    }
  }

  async function handleSave() {
    const built = buildInput();
    if (typeof built === "string") {
      setError(built);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
    } finally {
      setSaving(false);
    }
  }

  function setOption(i: number, patch: Partial<ChoiceOption>) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function toggleCorrect(i: number) {
    setOptions((prev) =>
      prev.map((o, idx) =>
        idx === i ? { ...o, correct: !o.correct } : multi ? o : { ...o, correct: false }
      )
    );
  }

  return (
    <>
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
          <h3>{initial ? t("card.editTitle") : t("card.newTitle")}</h3>
          {error && <div className="error-banner">{error}</div>}

          <label>
            {t("card.type")}
            <select value={type} onChange={(e) => setType(e.target.value as CardType)}>
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`card.type.${tp}`)}
                </option>
              ))}
            </select>
          </label>

          {/* Vorderseite / Frage / Aussage / Cloze-Text */}
          <MarkdownField
            label={
              type === "truefalse"
                ? t("card.statement")
                : type === "cloze"
                  ? t("card.clozeText")
                  : type === "basic"
                    ? t("card.front")
                    : t("card.question")
            }
            value={front}
            autoFocus
            enableCloze={type === "cloze"}
            onChange={setFront}
            onError={setError}
          />

          {type === "basic" && (
            <MarkdownField label={t("card.back")} value={back} onChange={setBack} onError={setError} />
          )}

          {type === "type_answer" && (
            <>
              <MarkdownField label={t("card.answer")} value={back} onChange={setBack} onError={setError} />
              <label>
                {t("card.acceptedAnswers")}
                <textarea value={variants} onChange={(e) => setVariants(e.target.value)} rows={2} />
              </label>
            </>
          )}

          {type === "choice" && (
            <div className="choice-editor">
              <span className="md-field-label">{t("card.options")}</span>
              {options.map((opt, i) => (
                <div className="choice-row" key={i}>
                  <input
                    type={multi ? "checkbox" : "radio"}
                    checked={opt.correct}
                    onChange={() => toggleCorrect(i)}
                    title={t("card.optionCorrect")}
                  />
                  <input
                    type="text"
                    value={opt.text}
                    placeholder={`${t("card.option")} ${i + 1}`}
                    onChange={(e) => setOption(i, { text: e.target.value })}
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={options.length <= 2}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="choice-actions">
                <button type="button" onClick={() => setOptions((prev) => [...prev, { text: "", correct: false }])}>
                  {t("card.addOption")}
                </button>
                <label className="checkbox-row">
                  <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
                  {t("card.multi")}
                </label>
              </div>
              <MarkdownField label={t("card.explanation")} value={back} onChange={setBack} onError={setError} />
            </div>
          )}

          {type === "truefalse" && (
            <div className="truefalse-editor">
              <span className="md-field-label">{t("card.correctAnswer")}</span>
              <div className="md-tabs">
                <button type="button" className={tfAnswer ? "active" : ""} onClick={() => setTfAnswer(true)}>
                  {t("card.trueLabel")}
                </button>
                <button type="button" className={!tfAnswer ? "active" : ""} onClick={() => setTfAnswer(false)}>
                  {t("card.falseLabel")}
                </button>
              </div>
            </div>
          )}

          {type === "cloze" && (
            <MarkdownField label={t("card.notes")} value={back} onChange={setBack} onError={setError} />
          )}

          {type === "basic" && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
              />
              {t("card.bidirectionalOption")}
            </label>
          )}

          <div className="modal-actions">
            {initial && (
              <button type="button" onClick={() => setShowExport(true)} disabled={saving}>
                {t("card.export")}
              </button>
            )}
            <button onClick={onCancel} disabled={saving}>
              {t("common.cancel")}
            </button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>

      {showExport && initial && (
        <ExportDialog
          title={t("export.cardTitle")}
          availableTypes={[initial.type]}
          onCancel={() => setShowExport(false)}
          onExport={(opts) => api.exportCard(initial.id, opts)}
        />
      )}
    </>
  );
}
