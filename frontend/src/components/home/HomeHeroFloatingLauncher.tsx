import { Link } from "react-router-dom";
import { getHomepageHeroLauncherCalculators, homepageCalculatorLauncherShortTitle } from "../../data/homepageCalculators";
import { HomeCalculatorIcon } from "./HomeCalculatorIcon";

function RoundArrowCta() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10 8l5 4-5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeHeroFloatingLauncher() {
  const items = getHomepageHeroLauncherCalculators();

  return (
    <div className="pg-home-hero-launcher">
      <div className="pg-home-hero-launcher-main">
        <div className="pg-home-hero-launcher-copy">
          <p className="pg-home-hero-launcher-kicker">Quick calculation start</p>
          <p className="pg-home-hero-launcher-lead">Choose a calculator to get started in seconds.</p>
        </div>
        <ul className="pg-home-hero-launcher-links" aria-label="Quick calculator shortcuts">
          {items.map((c) => (
            <li key={c.id}>
              <Link to={c.route} className="pg-home-hero-launcher-link">
                <HomeCalculatorIcon slug={c.templateKey} label={c.title} />
                <span className="pg-home-hero-launcher-link-text">
                  {homepageCalculatorLauncherShortTitle(c.title)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/calculators" className="pg-home-hero-launcher-orbit" aria-label="Browse all calculators">
          <RoundArrowCta />
        </Link>
      </div>
    </div>
  );
}
