import { useState } from "react";
import { useLocale } from "../../i18n";
import { normalizeAnswer } from "../../lib/markdown";
import Markdown from "../Markdown";
import type { StudyCardProps } from "./StudyCard";

/** Nutzer tippt die Antwort; Auto-Abgleich, aber die Wertung bleibt beim Nutzer. */
export default function TypeAnswerCard({ item, onAnswer }: StudyCardProps) {
  const { t } = useLocale();
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);

  const accepted = [item.back, ...(item.data?.answers ?? [])].map(normalizeAnswer).filter(Boolean);
  const autoCorrect = accepted.includes(normalizeAnswer(typed));

  return (
    <>
      <div className="study-card study-card-rich">
        <div className="study-card-body">
          <Markdown>{item.front}</Markdown>
        </div>
      </div>

      {!checked ? (
        <>
          <input
            type="text"
            className="study-input"
            autoFocus
            value={typed}
            placeholder={t("study.typePlaceholder")}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setChecked(true)}
          />
          <div className="study-answer-row">
            <button className="primary" onClick={() => setChecked(true)}>
              {t("study.check")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={`study-verdict ${autoCorrect ? "ok" : "bad"}`}>
            {autoCorrect ? t("study.answerCorrect") : t("study.answerWrong")}
          </div>
          <div className="study-expected">
            <span className="study-expected-label">{t("study.expected")}</span>
            <Markdown>{item.back}</Markdown>
            {typed.trim() && (
              <div className="study-your-answer">
                {t("study.yourAnswer")}: <strong>{typed}</strong>
              </div>
            )}
          </div>
          <div className="study-answer-row">
            <button className="danger" onClick={() => onAnswer(false)}>
              {t("study.wrongBtn")}
            </button>
            <button className="primary" onClick={() => onAnswer(true)}>
              {autoCorrect ? t("study.correctBtn") : t("study.markCorrect")}
            </button>
          </div>
        </>
      )}
    </>
  );
}
