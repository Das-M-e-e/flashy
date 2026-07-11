import { useLocale } from "../i18n";
import { cardConfidence } from "../lib/mastery";
import type { Card } from "../types";

const ARROW: Record<string, string> = { forward: "→", backward: "←" };

/**
 * Farbige Seitenlinie links an einer Karte, die die Confidence-Stufe zeigt.
 * Bidirektionale Karten haben zwei Segmente (je Richtung). Beim Hovern über
 * die Zeile blendet ein kleines Panel die Scores ein (rein per CSS).
 */
export default function CardConfidence({ card }: { card: Card }) {
  const { t } = useLocale();
  const { directions } = cardConfidence(card);

  return (
    <div className="card-confidence">
      <div className="confidence-bar" aria-hidden>
        {directions.map((d) => (
          <span key={d.direction} className="confidence-segment" style={{ background: `var(--bucket-${d.bucket})` }} />
        ))}
      </div>
      <div className="confidence-popover" role="tooltip">
        {directions.map((d) => (
          <div key={d.direction} className="confidence-line">
            {card.bidirectional && <span className="confidence-arrow">{ARROW[d.direction]}</span>}
            <span className="confidence-dot" style={{ background: `var(--bucket-${d.bucket})` }} />
            <span>{t(`bucket.${d.bucket}`)}</span>
            <span className="confidence-level">{t("confidence.level", { n: d.level })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
