import { homepagePublicCalculators } from "../../../data/homepageMarketingContent";
import { HomeMarketingCalculatorsWizardPreview } from "./HomeMarketingCalculatorsWizardPreview";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingSection } from "./HomeMarketingSection";
import { HomeMarketingSectionCta } from "./HomeMarketingSectionCta";

export function HomeMarketingCalculatorsSection() {
  const content = homepagePublicCalculators;

  return (
    <HomeMarketingSection id="calculators" className="hm-section--calculators">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        pain={content.pain}
        title={content.title}
        benefit={content.benefit}
      />

      <p className="hm-calc-logic-note">{content.logicNote}</p>

      <ol className="hm-calc-steps" aria-label="How Proplytic calculators work">
        {content.steps.map((step) => (
          <li key={step.number} className="hm-calc-steps__item">
            <span className="hm-calc-steps__num" aria-hidden>
              {step.number}
            </span>
            <div className="hm-calc-steps__body">
              <h3 className="hm-calc-steps__title">{step.title}</h3>
              <p className="hm-calc-steps__detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <HomeMarketingCalculatorsWizardPreview />

      <p className="hm-calc-public-note">{content.publicHubNote}</p>

      <HomeMarketingSectionCta primary={content.cta} secondary={content.secondaryCta} />
    </HomeMarketingSection>
  );
}
