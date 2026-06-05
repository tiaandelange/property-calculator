type Props = {
  className?: string;
};

/** Decorative rising portfolio trend line (SVG). */
export function MiniLineChart({ className }: Props) {
  return (
    <div className={["pg-hero-report-line-chart", className].filter(Boolean).join(" ")} aria-hidden>
      <svg viewBox="0 0 140 52" preserveAspectRatio="none" role="presentation">
        {[12, 24, 36].map((y) => (
          <line
            key={y}
            x1="8"
            y1={y}
            x2="132"
            y2={y}
            className="pg-hero-report-line-chart__grid"
          />
        ))}
        <line x1="8" y1="8" x2="8" y2="44" className="pg-hero-report-line-chart__grid" />
        <polyline
          points="12,38 32,34 52,30 72,22 92,18 112,12 128,8"
          className="pg-hero-report-line-chart__line"
        />
        <circle cx="128" cy="8" r="2.5" className="pg-hero-report-line-chart__dot" />
      </svg>
    </div>
  );
}
