import { useMemo, useState } from "react";
import type { Components } from "react-markdown";
import { useLocale } from "../../i18n";
import { clozeBlanks, clozeTokenIndex, normalizeAnswer, type ClozeBlank } from "../../lib/markdown";
import Markdown from "../Markdown";
import type { StudyCardProps } from "./StudyCard";

interface BlankProps {
  blank: ClozeBlank;
  value: string;
  checked: boolean;
  correct: boolean;
  autoFocus: boolean;
  onChange: (value: string) => void;
  onEnter: () => void;
}

/** Eingabefeld für eine einzelne Lücke, eingebettet in den Markdown-Textfluss. */
function ClozeBlankInput({ blank, value, checked, correct, autoFocus, onChange, onEnter }: BlankProps) {
  // Auf Hinweis-Länge orientieren, nicht auf die Antwort -- sonst verrät die Feldbreite die Lösung.
  const width = Math.max(blank.hint?.length ?? 0, 8);
  return (
    <span className={`cloze-blank${checked ? (correct ? " ok" : " bad") : ""}`}>
      <input
        type="text"
        value={value}
        placeholder={blank.hint ?? ""}
        size={width}
        disabled={checked}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
      />
      {checked && !correct && <span className="cloze-blank-answer">{blank.answer}</span>}
    </span>
  );
}

/** Lückentext: die Lücken werden direkt als Eingabefelder im Kartentext dargestellt. */
export default function ClozeCard({ item, onAnswer }: StudyCardProps) {
  const { t } = useLocale();
  const { md, blanks } = useMemo(() => clozeBlanks(item.front), [item.front]);
  const [values, setValues] = useState<string[]>(() => blanks.map(() => ""));
  const [checked, setChecked] = useState(false);

  function setValue(i: number, v: string) {
    setValues((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  const correctness = blanks.map((b, i) => normalizeAnswer(values[i] ?? "") === normalizeAnswer(b.answer));
  const allCorrect = correctness.length > 0 && correctness.every(Boolean);

  const components = useMemo<Components>(
    () => ({
      code: ({ node: _node, className, children, ...props }) => {
        const i = clozeTokenIndex(String(children));
        if (i === null || !blanks[i]) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        return (
          <ClozeBlankInput
            blank={blanks[i]}
            value={values[i] ?? ""}
            checked={checked}
            correct={correctness[i]}
            autoFocus={i === 0}
            onChange={(v) => setValue(i, v)}
            onEnter={() => setChecked(true)}
          />
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blanks, values, checked, correctness]
  );

  return (
    <>
      <div className="study-card study-card-rich">
        <div className="study-card-body">
          <Markdown components={components}>{md}</Markdown>
        </div>
      </div>

      {!checked ? (
        <div className="study-answer-row">
          <button className="primary" onClick={() => setChecked(true)}>
            {t("study.check")}
          </button>
        </div>
      ) : (
        <>
          <div className={`study-verdict ${allCorrect ? "ok" : "bad"}`}>
            {allCorrect ? t("study.answerCorrect") : t("study.answerWrong")}
          </div>
          {item.back.trim() && (
            <div className="study-expected">
              <Markdown>{item.back}</Markdown>
            </div>
          )}
          <div className="study-answer-row">
            <button className="danger" onClick={() => onAnswer(false)}>
              {t("study.wrongBtn")}
            </button>
            <button className="primary" onClick={() => onAnswer(true)}>
              {allCorrect ? t("study.correctBtn") : t("study.markCorrect")}
            </button>
          </div>
        </>
      )}
    </>
  );
}
