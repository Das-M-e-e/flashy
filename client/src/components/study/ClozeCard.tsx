import { useState } from "react";
import { useLocale } from "../../i18n";
import { renderCloze } from "../../lib/markdown";
import Markdown from "../Markdown";
import type { StudyCardProps } from "./StudyCard";

/** Lückentext: verdeckt anzeigen -> aufdecken -> selbst bewerten. */
export default function ClozeCard({ item, onAnswer }: StudyCardProps) {
  const { t } = useLocale();
  const [revealed, setRevealed] = useState(false);
  const { masked, revealed: full } = renderCloze(item.front);

  return (
    <>
      <div className="study-card study-card-rich" onClick={() => setRevealed(true)}>
        <div className="study-card-body">
          <Markdown>{revealed ? full : masked}</Markdown>
          {revealed && item.back.trim() && (
            <div className="study-expected">
              <Markdown>{item.back}</Markdown>
            </div>
          )}
          <div className="study-card-hint">{revealed ? "" : t("study.clickToReveal")}</div>
        </div>
      </div>

      {revealed ? (
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
          <button className="primary" onClick={() => setRevealed(true)}>
            {t("study.reveal")}
          </button>
        </div>
      )}
    </>
  );
}
