import { cardConfidence } from "../lib/mastery";
import type { Card } from "../types";
import ConfidenceGauge from "./ConfidenceGauge";

const ARROW: Record<string, string> = { forward: "→", backward: "←" };

/**
 * Farbige Seitenlinie links an einer Karte, die die Confidence-Stufe zeigt.
 * Beim Hovern über die Zeile erscheint pro Richtung ein Tacho mit Prozentwert
 * und Stufe (transparent, ohne Rahmen; bidirektionale Karten zeigen zwei).
 */
export default function CardConfidence({ card }: { card: Card }) {
  const { directions } = cardConfidence(card);

  return (
    <div className="card-confidence">
      <div className="confidence-bar" aria-hidden>
        {directions.map((d) => (
          <span key={d.direction} className="confidence-segment" style={{ background: `var(--bucket-${d.bucket})` }} />
        ))}
      </div>
      <div className="confidence-gauges" role="tooltip">
        {directions.map((d) => (
          <ConfidenceGauge
            key={d.direction}
            percent={d.percent}
            bucket={d.bucket}
            arrow={card.bidirectional ? ARROW[d.direction] : undefined}
          />
        ))}
      </div>
    </div>
  );
}
