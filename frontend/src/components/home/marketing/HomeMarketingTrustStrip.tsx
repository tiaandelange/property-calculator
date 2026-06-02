import { homepageTrustValues } from "../../../data/homepageMarketingContent";

export function HomeMarketingTrustStrip() {
  return (
    <div className="hm-trust" role="list" aria-label="Why Proplytic">
      <ul className="hm-trust__list">
        {homepageTrustValues.map((text) => (
          <li key={text} className="hm-trust__item" role="listitem">
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
