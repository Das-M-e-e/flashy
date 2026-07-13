import { useMemo, useState } from "react";
import { useLocale } from "../../i18n";
import Markdown from "../Markdown";
import type { StudyCardProps } from "./StudyCard";

/** Multiple Choice (Einfach- oder Mehrfachauswahl), automatisch gewertet. */
export default function ChoiceCard({ item, onAnswer }: StudyCardProps) {
  const { t } = useLocale();
  const options = item.data?.options ?? [];
  const multi = Boolean(item.data?.multi);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);

  function toggle(i: number) {
    if (checked) return;
    setSelected((prev) => {
      if (!multi) return new Set([i]);
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const correct = useMemo(() => {
    const correctIdx = options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    const sel = [...selected].sort((a, b) => a - b);
    return correctIdx.length === sel.length && correctIdx.every((v, k) => v === sel[k]);
  }, [checked, selected, options]);

  function optionClass(i: number): string {
    if (!checked) return selected.has(i) ? "selected" : "";
    if (options[i].correct) return "correct";
    if (selected.has(i)) return "wrong";
    return "";
  }

  return (
    <>
      <div className="study-card study-card-rich">
        <div className="study-card-body">
          <Markdown>{item.front}</Markdown>
        </div>
      </div>

      <div className="choice-options">
        {options.map((opt, i) => (
          <button key={i} type="button" className={`choice-option ${optionClass(i)}`} onClick={() => toggle(i)}>
            <span className="choice-marker">{multi ? (selected.has(i) ? "☑" : "☐") : selected.has(i) ? "●" : "○"}</span>
            <Markdown>{opt.text}</Markdown>
          </button>
        ))}
      </div>

      {!checked ? (
        <div className="study-answer-row">
          <button className="primary" disabled={selected.size === 0} onClick={() => setChecked(true)}>
            {t("study.check")}
          </button>
        </div>
      ) : (
        <>
          <div className={`study-verdict ${correct ? "ok" : "bad"}`}>
            {correct ? t("study.answerCorrect") : t("study.answerWrong")}
          </div>
          {item.back.trim() && (
            <div className="study-expected">
              <Markdown>{item.back}</Markdown>
            </div>
          )}
          <div className="study-answer-row">
            <button className="primary" onClick={() => onAnswer(correct)}>
              {t("study.next")}
            </button>
          </div>
        </>
      )}
    </>
  );
}
