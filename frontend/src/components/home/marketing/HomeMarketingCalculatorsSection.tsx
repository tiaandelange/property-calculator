import { Link } from "react-router-dom";
import { PROPERTY_TYPES } from "../../../data/calculatorPropertyTypes";
import { homepageCalculators } from "../../../data/homepageMarketingContent";
import { AppIcon } from "../../icons/AppIcon";
import { ButtonLink } from "../../ui/Button";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingCalculatorsSection() {
  return (
    <HomeMarketingSection id="calculators" tone="muted" className="hm-section--calculators">
      <HomeMarketingSectionHeader title={homepageCalculators.title} lead={homepageCalculators.lead} />

      <ol className="hm-calc-flow" aria-label="How Proplytic calculators work">
        {homepageCalculators.flowSteps.map((step) => (
          <li key={step.step} className="hm-calc-flow__step">
            <span className="hm-calc-flow__num" aria-hidden>
              {step.step}
            </span>
            <div className="hm-calc-flow__body">
              <h3 className="hm-calc-flow__title">{step.title}</h3>
              <p className="hm-calc-flow__detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <ul className="hm-type-grid hm-type-grid--chips" aria-label="Supported property types">
        {PROPERTY_TYPES.map((pt) => (
          <li key={pt.propertyType}>
            <Link to={homepageCalculators.cta.href} className="hm-type-card hm-type-card--chip">
              <AppIcon name={pt.icon} size="sm" className="hm-type-card__icon" />
              <span className="hm-type-card__label">{formatPropertyTypeLabel(pt.label)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hm-section-cta">
        <ButtonLink href={homepageCalculators.cta.href} variant="primary">
          {homepageCalculators.cta.label}
        </ButtonLink>
      </div>
    </HomeMarketingSection>
  );
}

/** Display label aligned with homepage marketing spec. */
function formatPropertyTypeLabel(label: string): string {
  if (label === "Airbnb / Short Term Rental") {
    return "Airbnb / Short-Term Rental";
  }
  return label;
}
