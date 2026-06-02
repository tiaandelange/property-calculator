import { homepageProblems } from "../../../data/homepageMarketingContent";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingProblemSection() {
  return (
    <HomeMarketingSection tone="muted">
      <HomeMarketingSectionHeader title={homepageProblems.title} />
      <ul className="hm-card-grid hm-card-grid--2">
        {homepageProblems.cards.map((text) => (
          <li key={text} className="hm-problem-card">
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </HomeMarketingSection>
  );
}
