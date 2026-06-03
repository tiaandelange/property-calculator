import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { homepageHeroAppPreview } from "../../../data/homepageMarketingContent";
import { HomeMarketingPreviewShell } from "./HomeMarketingPreviewShell";
import { HomeMarketingHeroProjectionSections } from "./HomeMarketingHeroProjectionSections";

export function HomeMarketingHeroAppPreview() {
  const preview = homepageHeroAppPreview;

  return (
    <div
      className="hm-app-preview hm-app-preview--hero hm-app-preview--hero-desktop"
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

        <HomeMarketingHeroProjectionSections />
      </HomeMarketingPreviewShell>
      <p className="hm-app-preview__caption">{preview.caption}</p>
    </div>
  );
}
