interface Props {
  percent: number;
  size?: number;
  stroke?: number;
  /** Wird angezeigt, wenn es noch keine Items gibt. */
  empty?: boolean;
}

/** Donut-Fortschrittsanzeige mit Farbverlauf und Prozentwert in der Mitte. */
export default function ProgressRing({ percent, size = 56, stroke = 6, empty = false }: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const gradientId = `ring-${size}-${stroke}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--ring-from)" />
          <stop offset="100%" stopColor="var(--ring-to)" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth={stroke}
      />
      {!empty && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      )}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="progress-ring-label"
        fontSize={size * 0.26}
      >
        {empty ? "–" : `${clamped}%`}
      </text>
    </svg>
  );
}
