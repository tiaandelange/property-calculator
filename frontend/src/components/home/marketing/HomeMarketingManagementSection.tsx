import { homepageManagement } from "../../../data/homepageMarketingContent";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingManagementSection() {
  return (
    <HomeMarketingSection>
      <HomeMarketingSectionHeader title={homepageManagement.title} lead={homepageManagement.lead} />
      <ul className="hm-mgmt-grid">
        {homepageManagement.items.map((item) => (
          <li key={item.label} className="hm-mgmt-card">
            <h3 className="hm-mgmt-card__title">{item.label}</h3>
            <p className="hm-mgmt-card__detail">{item.detail}</p>
          </li>
        ))}
      </ul>
    </HomeMarketingSection>
  );
}
