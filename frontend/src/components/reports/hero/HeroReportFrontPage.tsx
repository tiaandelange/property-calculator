import { HERO_REPORT_FRONT } from "./heroReportSampleData";
import { MiniLineChart } from "./MiniLineChart";
import { MiniMetricCard } from "./MiniMetricCard";
import { MiniReportTable } from "./MiniReportTable";

const { title, period, portfolioCount, prepared, metrics, properties, footer } = HERO_REPORT_FRONT;

export function HeroReportFrontPage() {
  return (
    <>
      <header className="pg-hero-report-front__head">
        <img
          src="/proplytic_logo_600x200_nobg.png"
          alt=""
          width={72}
          height={24}
          className="pg-hero-report-front__logo"
        />
        <div className="pg-hero-report-front__meta">
          <span>{period}</span>
          <span>{portfolioCount}</span>
          <span>{prepared}</span>
        </div>
      </header>

      <h3 className="pg-hero-report-cover-title">{title}</h3>

      <section className="pg-hero-report-section">
        <h4 className="pg-hero-report-section__title">Executive Summary</h4>
        <div className="pg-hero-report-metrics-grid">
          {metrics.map((m) => (
            <MiniMetricCard key={m.label} label={m.label} value={m.value} compact />
          ))}
        </div>
      </section>

      <section className="pg-hero-report-section pg-hero-report-section--tight">
        <h4 className="pg-hero-report-section__title">Portfolio Trend</h4>
        <MiniLineChart />
      </section>

      <section className="pg-hero-report-section pg-hero-report-section--tight">
        <h4 className="pg-hero-report-section__title">Top Properties</h4>
        <MiniReportTable
          compact
          columns={[
            { key: "name", label: "Property" },
            { key: "value", label: "Value", align: "right" },
            { key: "cashFlow", label: "Cash Flow", align: "right" }
          ]}
          rows={properties}
        />
      </section>

      <footer className="pg-hero-report-front__footer">{footer}</footer>
    </>
  );
}
