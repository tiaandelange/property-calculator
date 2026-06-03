import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { homepageHeroAppPreview } from "../../../data/homepageMarketingContent";
import { formatHeroProjectionCell, homepageHeroProjectionPreview } from "../../../data/homepagePreviewContent";

/** Narrow-viewport hero mock — metrics + compact projection excerpt (≤480px only via CSS). */
export function HomeMarketingHeroAppPreviewMobile() {
  const preview = homepageHeroAppPreview;
  const projection = homepageHeroProjectionPreview;
  const metrics = preview.metrics.slice(0, 2);
  const equityRow = projection.metrics.find((m) => m.key === "equity");
  const cashRow = projection.metrics.find((m) => m.key === "cashFlow");

  return (
    <div
      className="hm-app-preview hm-app-preview--hero hm-app-preview--hero-compact"
      role="img"
      aria-label="Proplytic portfolio dashboard preview with equity, cash flow and projection overview"
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

        <section className="hm-app-preview__panel hm-app-preview__panel--projection-compact">
          <div className="hm-app-preview__panel-head">
            <h3 className="hm-app-preview__panel-title">Detailed Overview</h3>
            <span className="hm-app-preview__panel-meta">{projection.propertyName}</span>
          </div>
          <table className="hm-app-preview__table hm-app-preview__table--projection-compact">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Y1</th>
                <th scope="col">Y5</th>
                <th scope="col">Y10</th>
              </tr>
            </thead>
            <tbody>
              {equityRow && cashRow ? (
                <>
                  <tr>
                    <th scope="row">{equityRow.label}</th>
                    <td>{formatHeroProjectionCell("zar", equityRow.values[0])}</td>
                    <td>{formatHeroProjectionCell("zar", equityRow.values[2])}</td>
                    <td>{formatHeroProjectionCell("zar", equityRow.values[3])}</td>
                  </tr>
                  <tr>
                    <th scope="row">{cashRow.label}</th>
                    <td>{formatHeroProjectionCell("zar", cashRow.values[0])}</td>
                    <td>{formatHeroProjectionCell("zar", cashRow.values[2])}</td>
                    <td>{formatHeroProjectionCell("zar", cashRow.values[3])}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </section>

        <div className="hm-app-preview__compact-property">
          <span className="hm-app-preview__compact-property-name">{projection.propertyName}</span>
          <span className="hm-app-preview__compact-property-meta">Projection · illustrative</span>
          <span className="hm-app-preview__metric-icon" aria-hidden>
            <AppIcon name="property" size="sm" />
          </span>
        </div>
      </div>
      <p className="hm-app-preview__caption">{preview.caption}</p>
    </div>
  );
}
