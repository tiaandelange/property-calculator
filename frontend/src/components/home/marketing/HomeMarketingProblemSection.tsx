import { homepageProblems, MARKETING_CTA_VIEW_PRICING } from "../../../data/homepageMarketingContent";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingSection } from "./HomeMarketingSection";
import { HomeMarketingSectionCta } from "./HomeMarketingSectionCta";

export function HomeMarketingProblemSection() {
  const content = homepageProblems;

  return (
    <HomeMarketingSection tone="muted" className="hm-section--problem">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        pain={content.pain}
        title={content.title}
        benefit={content.benefit}
      />
      <ul className="hm-card-grid hm-card-grid--2 hm-conv-cards">
        {content.cards.map((card, index) => (
          <li key={card.title} className="hm-problem-card">
            <span className="hm-problem-card__index" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="hm-problem-card__title">{card.title}</h3>
            <p className="hm-problem-card__body">{card.body}</p>
          </li>
        ))}
      </ul>
      <HomeMarketingSectionCta primary={content.cta} secondary={MARKETING_CTA_VIEW_PRICING} />
    </HomeMarketingSection>
  );
}
