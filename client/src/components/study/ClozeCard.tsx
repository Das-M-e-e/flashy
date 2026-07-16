import { useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import { useLocale } from "../../i18n";
import { clozeBlankWidth, clozeBlanks, clozeTokenIndex, normalizeAnswer, type ClozeBlank } from "../../lib/markdown";
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
  const width = clozeBlankWidth(blank);
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

  // Refs statt Closure-Deps: der `code`-Renderer muss über Tastatureingaben hinweg
  // referenzstabil bleiben, sonst hält react-markdown ihn für eine neue Komponente
  // und hängt alle Eingabefelder neu ein -- das reißt den Fokus zurück auf das erste.
  const stateRef = useRef({ values, checked, correctness });
  stateRef.current = { values, checked, correctness };

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
        const { values: v, checked: c, correctness: corr } = stateRef.current;
        return (
          <ClozeBlankInput
            blank={blanks[i]}
            value={v[i] ?? ""}
            checked={c}
            correct={corr[i]}
            autoFocus={i === 0}
            onChange={(val) => setValue(i, val)}
            onEnter={() => setChecked(true)}
          />
        );
      },
    }),
    [blanks]
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
            {allCorrect ? (
              <button className="primary" onClick={() => onAnswer(true)}>
                {t("study.next")}
              </button>
            ) : (
              <>
                <button className="danger" onClick={() => onAnswer(false)}>
                  {t("study.wrongBtn")}
                </button>
                <button className="primary" onClick={() => onAnswer(true)}>
                  {t("study.markCorrect")}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
