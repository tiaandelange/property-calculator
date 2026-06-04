import { Calculator } from "lucide-react";
import { IconContainerByName } from "../icons";
import { SearchInput } from "../ui/Input";
import { Container } from "../ui/Container";
import { CalculatorHubLandingHeroBackdrop } from "./CalculatorHubLandingHeroBackdrop";
import { CalculatorHubLandingHeroMockup } from "./CalculatorHubLandingHeroMockup";

const FEATURES = [
  {
    icon: "shield" as const,
    title: "Built for SA",
    description: "Local rates, costs and regulations"
  },
  {
    icon: "accurate" as const,
    title: "Accurate",
    description: "Up-to-date formulas you can trust"
  },
  {
    icon: "scenarios" as const,
    title: "Save & Compare",
    description: "Store results and compare multiple scenarios"
  }
] as const;

type CalculatorHubLandingHeroProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchInputId?: string;
};

export function CalculatorHubLandingHero({
  searchQuery,
  onSearchQueryChange,
  searchInputId = "calc-hub-hero-search"
}: CalculatorHubLandingHeroProps) {
  return (
    <header className="pg-calc-hub-landing-hero" aria-labelledby="calc-hub-landing-hero-heading">
      <div className="pg-calc-hub-landing-hero__glow pg-calc-hub-landing-hero__glow--copy" aria-hidden />
      <div className="pg-calc-hub-landing-hero__glow pg-calc-hub-landing-hero__glow--visual" aria-hidden />
      <CalculatorHubLandingHeroBackdrop />
      <Container className="pg-container pg-container--marketing-wide pg-calc-hub-landing-hero__container">
        <div className="pg-calc-hub-landing-hero__grid">
          <div className="pg-calc-hub-landing-hero__copy">
            <p className="pg-calc-hub-landing-hero__badge">
              <Calculator size={14} strokeWidth={2.25} aria-hidden />
              <span>Smart calculators</span>
            </p>
            <h1 id="calc-hub-landing-hero-heading" className="pg-calc-hub-landing-hero__title">
              Make smarter property decisions with{" "}
              <span className="pg-calc-hub-landing-hero__accent">confidence.</span>
            </h1>
            <p className="pg-calc-hub-landing-hero__subtitle">
              Powerful, easy-to-use calculators built for South African property investors.
            </p>
            <SearchInput
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search calculators..."
              aria-label="Search calculators"
              autoComplete="off"
              wrapperClassName="pg-calc-hub-landing-hero__search"
              className="pg-calc-hub-landing-hero__search-input"
            />
            <ul className="pg-calc-hub-landing-hero__features" aria-label="Calculator highlights">
              {FEATURES.map((feature) => (
                <li key={feature.title}>
                  <IconContainerByName icon={feature.icon} accent="purple" size="sm" />
                  <div>
                    <span className="pg-calc-hub-landing-hero__feature-title">{feature.title}</span>
                    <span className="pg-calc-hub-landing-hero__feature-desc">{feature.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <CalculatorHubLandingHeroMockup />
        </div>
      </Container>
      <div className="pg-calc-hub-landing-hero__wave" aria-hidden>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false">
          <path
            d="M0,48 C360,88 720,0 1080,40 C1260,56 1380,64 1440,52 L1440,80 L0,80 Z"
            fill="var(--home-band-bg)"
          />
        </svg>
      </div>
    </header>
  );
}
