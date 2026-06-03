import { homepageWhoItsFor } from "../../../data/homepageMarketingContent";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";
import { HomeMarketingSectionCta } from "./HomeMarketingSectionCta";

export function HomeMarketingWhoItsFor() {
  const content = homepageWhoItsFor;

  return (
    <HomeMarketingSection id="who-its-for" className="hm-section--who">
      <HomeMarketingSectionHeader title={content.title} lead={content.lead} align="center" />
      <ul className="hm-who-grid">
        {content.fit.map((item) => (
          <li key={item.title} className="hm-who-card">
            <h3 className="hm-who-card__title">{item.title}</h3>
            <p className="hm-who-card__body">{item.body}</p>
          </li>
        ))}
      </ul>
      <p className="hm-who-not-for">
        <strong>Not for:</strong> {content.notFor}
      </p>
      <HomeMarketingSectionCta primary={content.cta} secondary={content.secondaryCta} />
    </HomeMarketingSection>
  );
}
