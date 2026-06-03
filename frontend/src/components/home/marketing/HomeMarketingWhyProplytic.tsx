import { homepageWhyProplytic } from "../../../data/homepageMarketingContent";
import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingWhyProplytic() {
  const content = homepageWhyProplytic;

  return (
    <HomeMarketingSection id="why-proplytic" tone="muted" className="hm-section--why">
      <HomeMarketingSectionHeader title={content.title} lead={content.lead} align="center" />
      <ul className="hm-why-grid">
        {content.bullets.map((item) => (
          <li key={item.title} className="hm-why-card">
            <span className="hm-why-card__icon" aria-hidden>
              <AppIcon name={item.icon as IconName} size="md" />
            </span>
            <div className="hm-why-card__copy">
              <h3 className="hm-why-card__title">{item.title}</h3>
              <p className="hm-why-card__body">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </HomeMarketingSection>
  );
}
