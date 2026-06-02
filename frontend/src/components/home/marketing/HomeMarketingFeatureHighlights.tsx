import { AppIcon } from "../../icons/AppIcon";
import { homepageFeatureHighlights } from "../../../data/homepageMarketingContent";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

const FEATURE_ICONS = [
  "portfolio",
  "tenants",
  "invoices",
  "statements",
  "expenses",
  "calculators",
  "pdf",
  "activity"
] as const;

export function HomeMarketingFeatureHighlights() {
  return (
    <HomeMarketingSection tone="muted">
      <HomeMarketingSectionHeader title={homepageFeatureHighlights.title} align="left" />
      <ul className="hm-card-grid hm-card-grid--3">
        {homepageFeatureHighlights.items.map((label, i) => (
          <li key={label} className="hm-feature-card">
            <AppIcon name={FEATURE_ICONS[i] ?? "property"} size="md" className="hm-feature-card__icon" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </HomeMarketingSection>
  );
}
