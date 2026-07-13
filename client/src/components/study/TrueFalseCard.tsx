import { useState } from "react";
import { useLocale } from "../../i18n";
import Markdown from "../Markdown";
import type { StudyCardProps } from "./StudyCard";

/** Aussage bewerten: Wahr oder Falsch, automatisch gewertet. */
export default function TrueFalseCard({ item, onAnswer }: StudyCardProps) {
  const { t } = useLocale();
  const answer = Boolean(item.data?.answer);
  const [choice, setChoice] = useState<boolean | null>(null);
  const correct = choice !== null && choice === answer;

  return (
    <>
      <div className="study-card study-card-rich">
        <div className="study-card-body">
          <Markdown>{item.front}</Markdown>
        </div>
      </div>

      {choice === null ? (
        <div className="study-answer-row">
          <button className="primary" onClick={() => setChoice(true)}>
            {t("card.trueLabel")}
          </button>
          <button className="primary" onClick={() => setChoice(false)}>
            {t("card.falseLabel")}
          </button>
        </div>
      ) : (
        <>
          <div className={`study-verdict ${correct ? "ok" : "bad"}`}>
            {correct ? t("study.answerCorrect") : t("study.answerWrong")}
            {" — "}
            {answer ? t("card.trueLabel") : t("card.falseLabel")}
          </div>
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
