import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { homepagePillars } from "../../../data/homepageMarketingContent";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingSection } from "./HomeMarketingSection";

const PILLAR_ICONS: Record<string, IconName> = {
  connected: "portfolio",
  portfolio: "activity",
  admin: "leases",
  decisions: "reports"
};

export function HomeMarketingSolutionSection() {
  const content = homepagePillars;

  return (
    <HomeMarketingSection id="solution" className="hm-section--solution">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        pain={content.pain}
        title={content.title}
        benefit={content.benefit}
      />
      <ul className="hm-card-grid hm-card-grid--4 hm-pillar-grid hm-conv-cards">
        {content.items.map((item) => (
          <li
            key={item.id}
            className={`hm-pillar-card${"emphasis" in item && item.emphasis ? " hm-pillar-card--emphasis" : ""}`}
          >
            <AppIcon
              name={PILLAR_ICONS[item.id] ?? "property"}
              size="lg"
              className="hm-pillar-card__icon"
            />
            <h3 className="hm-pillar-card__title">{item.title}</h3>
            <p className="hm-pillar-card__body">{item.body}</p>
          </li>
        ))}
      </ul>
    </HomeMarketingSection>
  );
}
