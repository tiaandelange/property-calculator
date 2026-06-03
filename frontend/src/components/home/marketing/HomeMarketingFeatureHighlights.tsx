import { homepageFeatureHighlights } from "../../../data/homepageMarketingContent";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingFeatureShowcase } from "./HomeMarketingFeatureShowcase";
import { HomeMarketingSection } from "./HomeMarketingSection";
import { HomeMarketingSectionCta } from "./HomeMarketingSectionCta";

export function HomeMarketingFeatureHighlights() {
  const content = homepageFeatureHighlights;

  return (
    <HomeMarketingSection id="features" tone="muted" className="hm-section--features">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        pain={content.pain}
        title={content.title}
        benefit={content.benefit}
        align="left"
      />
      <ul className="hm-outcome-grid hm-conv-cards">
        {content.outcomes.map((item) => (
          <li key={item.title} className="hm-outcome-card">
            <h3 className="hm-outcome-card__title">{item.title}</h3>
            <p className="hm-outcome-card__body">{item.body}</p>
          </li>
        ))}
      </ul>
      <HomeMarketingFeatureShowcase />
      <HomeMarketingSectionCta
        primary={content.primaryCta}
        secondary={content.secondaryCta}
        align="left"
      />
    </HomeMarketingSection>
  );
}
