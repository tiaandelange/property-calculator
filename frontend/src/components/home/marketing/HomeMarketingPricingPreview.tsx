import {
  homepagePricing,
  homepagePricingPreviewPlans
} from "../../../data/homepageMarketingContent";
import { ButtonLink } from "../../ui/Button";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingPricingPreview() {
  return (
    <HomeMarketingSection id="pricing-preview" tone="muted" className="hm-section--pricing">
      <HomeMarketingSectionHeader title={homepagePricing.title} lead={homepagePricing.lead} align="center" />

      <ul className="hm-pricing-grid">
        {homepagePricingPreviewPlans.map((plan) => (
          <li
            key={plan.code}
            className={`hm-pricing-card${plan.highlighted ? " hm-pricing-card--highlight" : ""}`}
          >
            {plan.highlighted ? <span className="hm-pricing-card__badge">Popular</span> : null}
            <h3 className="hm-pricing-card__name">{plan.name}</h3>
            <p className="hm-pricing-card__best-for">{plan.bestFor}</p>
            <div className="hm-pricing-card__price-block">
              <p className="hm-pricing-card__price">{plan.priceLabel}</p>
              {plan.priceDetail ? (
                <p className="hm-pricing-card__price-detail">{plan.priceDetail}</p>
              ) : null}
            </div>
            <ul className="hm-pricing-card__bullets">
              {plan.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <ButtonLink href={plan.cta.href} variant={plan.highlighted ? "primary" : "secondary"} size="sm" fullWidth>
              {plan.cta.label}
            </ButtonLink>
          </li>
        ))}
      </ul>

      <div className="hm-section-cta">
        <ButtonLink href={homepagePricing.viewAllCta.href} variant="primary" size="lg">
          {homepagePricing.viewAllCta.label}
        </ButtonLink>
      </div>
    </HomeMarketingSection>
  );
}
