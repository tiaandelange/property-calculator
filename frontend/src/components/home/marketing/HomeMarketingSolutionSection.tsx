import { AppIcon } from "../../icons/AppIcon";
import { homepagePillars } from "../../../data/homepageMarketingContent";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

const PILLAR_ICONS = {
  analytics: "portfolio",
  management: "leases",
  calculators: "tools",
  reports: "reports"
} as const;

export function HomeMarketingSolutionSection() {
  return (
    <HomeMarketingSection id="features">
      <HomeMarketingSectionHeader title={homepagePillars.title} lead={homepagePillars.lead} />
      <ul className="hm-card-grid hm-card-grid--4">
        {homepagePillars.items.map((item) => (
          <li key={item.id} className="hm-pillar-card">
            <AppIcon
              name={PILLAR_ICONS[item.id as keyof typeof PILLAR_ICONS] ?? "property"}
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
