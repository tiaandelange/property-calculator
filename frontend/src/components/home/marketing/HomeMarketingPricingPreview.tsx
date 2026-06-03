import {
  homepagePricing,
  homepagePricingCompareRows,
  homepagePricingPreviewPlans,
  type HomepagePricingPreviewPlan
} from "../../../data/homepageMarketingContent";
import { AppIcon } from "../../icons/AppIcon";
import { ButtonLink } from "../../ui/Button";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingSection } from "./HomeMarketingSection";
import { HomeMarketingSectionCta } from "./HomeMarketingSectionCta";

function PricingFeatureList({
  items,
  variant
}: {
  items: readonly string[];
  variant: "included" | "excluded";
}) {
  if (!items.length) return null;

  return (
    <ul className={`hm-pricing-features hm-pricing-features--${variant}`}>
      {items.map((item) => (
        <li key={item}>
          <AppIcon
            name={variant === "included" ? "success" : "close"}
            size="sm"
            className="hm-pricing-features__icon"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingPlanCard({ plan }: { plan: HomepagePricingPreviewPlan }) {
  const cardClass = [
    "hm-pricing-card",
    plan.entry ? "hm-pricing-card--entry" : "",
    plan.recommended ? "hm-pricing-card--recommended" : "",
    plan.custom ? "hm-pricing-card--custom" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const buttonVariant = plan.custom ? "secondary" : "primary";

  return (
    <li className={cardClass}>
      {plan.recommended ? (
        <span className="hm-pricing-card__badge hm-pricing-card__badge--recommended">Recommended</span>
      ) : null}
      {plan.entry ? <span className="hm-pricing-card__badge hm-pricing-card__badge--entry">Start here</span> : null}

      <h3 className="hm-pricing-card__name">{plan.name}</h3>
      <p className="hm-pricing-card__best-for">{plan.bestFor}</p>

      <div className="hm-pricing-card__price-block">
        <p className="hm-pricing-card__price">
          <span className="hm-pricing-card__price-value">{plan.priceLabel}</span>
          {plan.pricePeriod ? (
            <span className="hm-pricing-card__price-period"> {plan.pricePeriod}</span>
          ) : null}
        </p>
        {plan.priceDetail ? <p className="hm-pricing-card__price-detail">{plan.priceDetail}</p> : null}
      </div>

      <PricingFeatureList items={plan.includes} variant="included" />
      {plan.excludes?.length ? <PricingFeatureList items={plan.excludes} variant="excluded" /> : null}

      <ButtonLink href={plan.cta.href} variant={buttonVariant} size="sm" fullWidth className="hm-pricing-card__cta">
        {plan.cta.label}
      </ButtonLink>
    </li>
  );
}

export function HomeMarketingPricingPreview() {
  const content = homepagePricing;

  return (
    <HomeMarketingSection id="pricing-preview" tone="muted" className="hm-section--pricing">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        pain={content.pain}
        title={content.title}
        benefit={content.benefit}
      />

      <p className="hm-pricing-tagline">{content.tagline}</p>

      <ul className="hm-pricing-grid">
        {homepagePricingPreviewPlans.map((plan) => (
          <PricingPlanCard key={plan.code} plan={plan} />
        ))}
      </ul>

      <div className="hm-pricing-compare" aria-label="Plan comparison at a glance">
        <p className="hm-pricing-compare__title">Compare at a glance</p>
        <div className="hm-pricing-compare__table-wrap">
          <table className="hm-pricing-compare__table">
            <thead>
              <tr>
                <th scope="col"> </th>
                <th scope="col">Starter</th>
                <th scope="col" className="hm-pricing-compare__col--recommended">
                  Investor
                </th>
                <th scope="col">Portfolio</th>
                <th scope="col">Custom</th>
              </tr>
            </thead>
            <tbody>
              {homepagePricingCompareRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.starter}</td>
                  <td className="hm-pricing-compare__col--recommended">{row.investor}</td>
                  <td>{row.portfolio}</td>
                  <td>{row.custom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HomeMarketingSectionCta primary={content.signupCta} secondary={content.viewAllCta} />
    </HomeMarketingSection>
  );
}
