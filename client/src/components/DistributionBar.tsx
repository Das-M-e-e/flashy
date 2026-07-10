import { useLocale } from "../i18n";
import type { MasteryBuckets } from "../types";

const SEGMENTS = [
  { key: "new", labelKey: "bucket.new", varName: "--bucket-new" },
  { key: "learning", labelKey: "bucket.learning", varName: "--bucket-learning" },
  { key: "known", labelKey: "bucket.known", varName: "--bucket-known" },
  { key: "mastered", labelKey: "bucket.mastered", varName: "--bucket-mastered" },
] as const;

/** Gestapelter Balken über die Lern-Buckets (neu / lernend / gekonnt / sicher). */
export default function DistributionBar({
  buckets,
  showLegend = false,
}: {
  buckets: MasteryBuckets;
  showLegend?: boolean;
}) {
  const { t } = useLocale();
  const total = buckets.new + buckets.learning + buckets.known + buckets.mastered;

  return (
    <div className="distribution">
      <div className="distribution-track" role="img" aria-label={t("mastery.secure", { percent: 0 })}>
        {total === 0 ? (
          <div className="distribution-empty" />
        ) : (
          SEGMENTS.map((seg) => {
            const value = buckets[seg.key];
            if (value === 0) return null;
            return (
              <div
                key={seg.key}
                title={`${t(seg.labelKey)}: ${value}`}
                style={{
                  width: `${(value / total) * 100}%`,
                  background: `var(${seg.varName})`,
                }}
              />
            );
          })
        )}
      </div>
      {showLegend && (
        <div className="distribution-legend">
          {SEGMENTS.map((seg) => (
            <span key={seg.key} className="legend-item">
              <span className="legend-dot" style={{ background: `var(${seg.varName})` }} />
              {t(seg.labelKey)} {buckets[seg.key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
