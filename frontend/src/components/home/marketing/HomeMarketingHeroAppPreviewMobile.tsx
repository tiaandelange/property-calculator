import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { homepageHeroAppPreview } from "../../../data/homepageMarketingContent";

/** Narrow-viewport hero mock — no sidebar rail or wide tables (≤480px only via CSS). */
export function HomeMarketingHeroAppPreviewMobile() {
  const preview = homepageHeroAppPreview;
  const maxBar = Math.max(...preview.chart.values);
  const metrics = preview.metrics.slice(0, 2);
  const topProperty = preview.properties[0];

  return (
    <div
      className="hm-app-preview hm-app-preview--hero hm-app-preview--hero-compact"
      role="img"
      aria-label="Proplytic portfolio dashboard preview with equity, cash flow and cash flow chart"
    >
      <div className="hm-app-preview__frame">
        <header className="hm-app-preview__compact-top">
          <span className="hm-app-preview__compact-title">{preview.pageTitle}</span>
          <span className="hm-app-preview__compact-chip">{preview.propertyCount}</span>
        </header>

        <div className="hm-app-preview__compact-metrics">
          {metrics.map((metric) => (
            <article
              key={metric.key}
              className={`hm-app-preview__metric${metric.highlight ? " hm-app-preview__metric--highlight" : ""}`}
            >
              <p className="hm-app-preview__metric-label">{metric.label}</p>
              <p className="hm-app-preview__metric-value">{metric.value}</p>
              <p className={`hm-app-preview__metric-change hm-app-preview__metric-change--${metric.changeTone}`}>
                {metric.change}
              </p>
            </article>
          ))}
        </div>

        <section className="hm-app-preview__panel hm-app-preview__panel--chart">
          <div className="hm-app-preview__panel-head">
            <h3 className="hm-app-preview__panel-title">{preview.chart.title}</h3>
          </div>
          <div className="hm-app-preview__chart-bars hm-app-preview__chart-bars--compact" aria-hidden>
            {preview.chart.values.slice(0, 8).map((value, index) => (
              <span
                key={index}
                className="hm-app-preview__chart-bar"
                style={{ height: `${Math.round((value / maxBar) * 100)}%` }}
              />
            ))}
          </div>
        </section>

        {topProperty ? (
          <div className="hm-app-preview__compact-property">
            <span className="hm-app-preview__compact-property-name">{topProperty.name}</span>
            <span className="hm-app-preview__compact-property-meta">
              {topProperty.cashFlow} · {topProperty.yield}
            </span>
            <span className="hm-app-preview__metric-icon" aria-hidden>
              <AppIcon name="property" size="sm" />
            </span>
          </div>
        ) : null}
      </div>
      <p className="hm-app-preview__caption">{preview.caption}</p>
    </div>
  );
}
