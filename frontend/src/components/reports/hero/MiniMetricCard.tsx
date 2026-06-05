type Props = {
  label: string;
  value: string;
  compact?: boolean;
};

/** Decorative mini KPI tile for hero report pages. */
export function MiniMetricCard({ label, value, compact }: Props) {
  return (
    <div className={`pg-hero-report-metric${compact ? " pg-hero-report-metric--compact" : ""}`}>
      <span className="pg-hero-report-metric__label">{label}</span>
      <strong className="pg-hero-report-metric__value">{value}</strong>
    </div>
  );
}
