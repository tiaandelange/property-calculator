type Segment = { label: string; pct: number; color: string };

type Props = {
  segments: readonly Segment[];
};

/** Decorative donut chart for cash-flow hero page. */
export function MiniDonutChart({ segments }: Props) {
  let offset = 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="pg-hero-report-donut" aria-hidden>
      <svg viewBox="0 0 48 48" role="presentation">
        <g transform="rotate(-90 24 24)">
          <circle cx="24" cy="24" r={radius} className="pg-hero-report-donut__track" />
          {segments.map((seg) => {
            const dash = (seg.pct / 100) * circumference;
            const el = (
              <circle
                key={seg.label}
                cx="24"
                cy="24"
                r={radius}
                className="pg-hero-report-donut__segment"
                stroke={seg.color}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      <ul className="pg-hero-report-donut__legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className="pg-hero-report-donut__swatch" style={{ background: seg.color }} />
            {seg.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
