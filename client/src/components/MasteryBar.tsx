import type { DeckStats } from "../types";

export default function MasteryBar({ stats }: { stats: DeckStats | undefined }) {
  if (!stats || stats.itemCount === 0) {
    return <div className="mastery-label">Noch keine Karten</div>;
  }
  return (
    <div>
      <div className="mastery-bar-track">
        <div className="mastery-bar-fill" style={{ width: `${stats.masteryPercent}%` }} />
      </div>
      <div className="mastery-label">
        {stats.masteryPercent}% sicher &middot; {stats.masteryLabel}
      </div>
    </div>
  );
}
