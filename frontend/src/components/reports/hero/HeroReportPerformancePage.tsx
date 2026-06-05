import { HERO_REPORT_PERFORMANCE } from "./heroReportSampleData";
import { MiniMetricCard } from "./MiniMetricCard";

const { title, bars, metrics, notes } = HERO_REPORT_PERFORMANCE;

export function HeroReportPerformancePage() {
  return (
    <>
      <p className="pg-hero-report-kicker">Section 03</p>
      <h3 className="pg-hero-report-page-title">{title}</h3>

      <div className="pg-hero-report-bars" aria-hidden>
        {bars.map((bar) => (
          <div key={bar.label} className="pg-hero-report-bars__item">
            <div className="pg-hero-report-bars__track">
              <span className="pg-hero-report-bars__fill" style={{ height: `${bar.pct}%` }} />
            </div>
            <span className="pg-hero-report-bars__label">{bar.label}</span>
          </div>
        ))}
      </div>

      <div className="pg-hero-report-metrics-grid pg-hero-report-metrics-grid--pair">
        {metrics.map((m) => (
          <MiniMetricCard key={m.label} label={m.label} value={m.value} compact />
        ))}
      </div>

      <div className="pg-hero-report-notes">
        {notes.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <span className="pg-hero-report-notes__line" aria-hidden />
        <span className="pg-hero-report-notes__line pg-hero-report-notes__line--short" aria-hidden />
      </div>
    </>
  );
}
