import { homepageFeatureHighlights } from "../../../data/homepageMarketingContent";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingSection } from "./HomeMarketingSection";
import { MarketingStackedPreviewCarousel } from "./MarketingStackedPreviewCarousel";

export function HomeMarketingFeatureHighlights() {
  const content = homepageFeatureHighlights;

  return (
    <HomeMarketingSection id="features" tone="muted" className="hm-section--features">
      <div className="hm-features-spotlight">
        <div className="hm-features-spotlight__copy">
          <HomeMarketingConversionHeader
            eyebrow={content.eyebrow}
            pain={content.pain}
            title={content.title}
            benefit={content.benefit}
            align="left"
          />
          <ul className="hm-reports-features">
            {content.outcomes.map((item) => (
              <li key={item.title}>{item.body}</li>
            ))}
          </ul>
        </div>
        <MarketingStackedPreviewCarousel />
      </div>
    </HomeMarketingSection>
  );
}
