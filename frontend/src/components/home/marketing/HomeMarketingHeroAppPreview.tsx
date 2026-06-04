import { homepageHeroAppPreview } from "../../../data/homepageMarketingContent";
import { HomeMarketingPreviewShell } from "./HomeMarketingPreviewShell";
import { HomeMarketingHeroProjectionSections } from "./HomeMarketingHeroProjectionSections";
import { PreviewMetricIcon } from "./homeMarketingPreviewMetricIcon";

export function HomeMarketingHeroAppPreview({ heroCube = false }: { heroCube?: boolean }) {
  const preview = homepageHeroAppPreview;

  return (
    <div
      className={[
        "hm-app-preview hm-app-preview--hero hm-app-preview--hero-desktop",
        heroCube ? "hm-app-preview--hero-cube" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label="Proplytic portfolio dashboard preview with equity, cash flow, yield, occupancy, detailed overview projection table and summary growth chart"
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
                <div className="hm-app-preview__metric-copy">
                  <p className="hm-app-preview__metric-label">{metric.label}</p>
                  <p className="hm-app-preview__metric-value">{metric.value}</p>
                </div>
                <PreviewMetricIcon label={metric.label} icon={metric.icon} />
              </div>
              <p className={`hm-app-preview__metric-change hm-app-preview__metric-change--${metric.changeTone}`}>
                {metric.change}
              </p>
            </article>
          ))}
        </div>

        <HomeMarketingHeroProjectionSections />
      </HomeMarketingPreviewShell>
      <p className="hm-app-preview__caption">{preview.caption}</p>
    </div>
  );
}
