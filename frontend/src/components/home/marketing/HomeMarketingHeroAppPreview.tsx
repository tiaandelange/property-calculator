import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { homepageHeroAppPreview } from "../../../data/homepageMarketingContent";
import { HomeMarketingPreviewShell } from "./HomeMarketingPreviewShell";

export function HomeMarketingHeroAppPreview() {
  const preview = homepageHeroAppPreview;
  const maxBar = Math.max(...preview.chart.values);

  return (
    <div
      className="hm-app-preview hm-app-preview--hero hm-app-preview--hero-desktop"
      role="img"
      aria-label="Proplytic portfolio dashboard preview with equity, cash flow, yield, occupancy, cash flow chart, property list and investment report card"
    >
      <HomeMarketingPreviewShell
        crumbs={["Portfolio", preview.pageTitle]}
        chips={[{ label: preview.propertyCount }, { label: preview.period, muted: true }]}
        activeNav={0}
      >
        <div className="hm-app-preview__metrics hm-app-preview__metrics--4">
          {preview.metrics.map((metric) => (
            <article
              key={metric.key}
              className={`hm-app-preview__metric${metric.highlight ? " hm-app-preview__metric--highlight" : ""}`}
            >
              <div className="hm-app-preview__metric-top">
                <div>
                  <p className="hm-app-preview__metric-label">{metric.label}</p>
                  <p className="hm-app-preview__metric-value">{metric.value}</p>
                </div>
                <span className="hm-app-preview__metric-icon" aria-hidden>
                  <AppIcon name={metric.icon as IconName} size="sm" />
                </span>
              </div>
              <p className={`hm-app-preview__metric-change hm-app-preview__metric-change--${metric.changeTone}`}>
                {metric.change}
              </p>
            </article>
          ))}
        </div>

        <div className="hm-app-preview__split">
          <section className="hm-app-preview__panel hm-app-preview__panel--chart">
            <div className="hm-app-preview__panel-head">
              <h3 className="hm-app-preview__panel-title">{preview.chart.title}</h3>
              <span className="hm-app-preview__panel-meta">{preview.chart.legend}</span>
            </div>
            <div className="hm-app-preview__chart-summary" aria-hidden>
              <span className="hm-app-preview__chart-summary-value">{preview.chart.summaryValue}</span>
              <span className="hm-app-preview__chart-summary-change hm-app-preview__metric-change--up">
                {preview.chart.summaryChange}
              </span>
            </div>
            <div className="hm-app-preview__chart-wrap">
              <div className="hm-app-preview__chart-bars hm-app-preview__chart-bars--hero" aria-hidden>
                {preview.chart.values.map((value, index) => (
                  <span
                    key={index}
                    className="hm-app-preview__chart-bar"
                    style={{ height: `${Math.round((value / maxBar) * 78 + 22)}%` }}
                  />
                ))}
              </div>
              <div className="hm-app-preview__chart-axis" aria-hidden>
                {preview.chart.months.map((month) => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </section>

          <div className="hm-app-preview__stack">
            <section className="hm-app-preview__panel">
              <div className="hm-app-preview__panel-head">
                <h3 className="hm-app-preview__panel-title">Top properties</h3>
                <span className="hm-app-preview__panel-meta">By net cash flow</span>
              </div>
              <table className="hm-app-preview__table">
                <thead>
                  <tr>
                    <th scope="col">Property</th>
                    <th scope="col">Cash flow</th>
                    <th scope="col">Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.properties.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <span className="hm-app-preview__property-name">{row.name}</span>
                        <span className="hm-app-preview__status">{row.status}</span>
                      </td>
                      <td>{row.cashFlow}</td>
                      <td>{row.yield}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="hm-app-preview__panel hm-app-preview__panel--report">
              <div className="hm-app-preview__panel-head">
                <h3 className="hm-app-preview__panel-title">{preview.reportCard.title}</h3>
                <span className="hm-app-preview__panel-badge">{preview.reportCard.status}</span>
              </div>
              <p className="hm-app-preview__report-property">{preview.reportCard.property}</p>
              <dl className="hm-app-preview__report-metrics">
                {preview.reportCard.metrics.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="hm-app-preview__report-action" aria-hidden>
                Export PDF
              </div>
            </section>
          </div>
        </div>
      </HomeMarketingPreviewShell>
      <p className="hm-app-preview__caption">{preview.caption}</p>
    </div>
  );
}
