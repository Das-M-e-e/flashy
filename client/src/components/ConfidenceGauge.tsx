import { useLocale } from "../i18n";
import type { Bucket } from "../lib/mastery";

interface Props {
  percent: number;
  bucket: Bucket;
  arrow?: string;
}

const SIZE = 46;
const STROKE = 5;
const GAUGE_FRACTION = 0.75; // 270°-Bogen, Öffnung unten (Tacho-Look)

/** Tacho-artige Confidence-Anzeige einer einzelnen Richtung. */
export default function ConfidenceGauge({ percent, bucket, arrow }: Props) {
  const { t } = useLocale();
  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const track = circumference * GAUGE_FRACTION;
  const value = track * (Math.max(0, Math.min(100, percent)) / 100);
  const center = SIZE / 2;

  return (
    <div className="conf-gauge">
      {arrow && <span className="conf-gauge-arrow">{arrow}</span>}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="conf-gauge-svg">
        {/* Startpunkt nach unten-links drehen -> Öffnung zeigt nach unten. */}
        <g transform={`rotate(135 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="var(--ring-track)"
            strokeWidth={STROKE}
            strokeDasharray={`${track} ${circumference}`}
          />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={`var(--bucket-${bucket})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${value} ${circumference}`}
          />
        </g>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="conf-gauge-value">
          {percent}%
        </text>
      </svg>
      <span className="conf-gauge-label">{t(`bucket.${bucket}`)}</span>
    </div>
  );
}
