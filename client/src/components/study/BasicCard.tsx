import { useState } from "react";
import { useLocale } from "../../i18n";
import { isRichContent } from "../../lib/markdown";
import Markdown from "../Markdown";
import type { StudyCardProps } from "./StudyCard";

/** Vorderseite -> umdrehen -> selbst bewerten. */
export default function BasicCard({ item, onAnswer }: StudyCardProps) {
  const { t } = useLocale();
  const [flipped, setFlipped] = useState(false);
  const text = flipped ? item.back : item.front;
  const rich = isRichContent(text);

  return (
    <>
      <div className={`study-card ${rich ? "study-card-rich" : ""}`} onClick={() => setFlipped((f) => !f)}>
        <div className="study-card-body">
          <Markdown>{text}</Markdown>
          <div className="study-card-hint">{flipped ? "" : t("study.clickToFlip")}</div>
        </div>
      </div>

      {flipped ? (
        <div className="study-answer-row">
          <button className="danger" onClick={() => onAnswer(false)}>
            {t("study.wrongBtn")}
          </button>
          <button className="primary" onClick={() => onAnswer(true)}>
            {t("study.correctBtn")}
          </button>
        </div>
      ) : (
        <div className="study-answer-row">
          <button className="primary" onClick={() => setFlipped(true)}>
            {t("study.flip")}
          </button>
        </div>
      )}
    </>
  );
}
