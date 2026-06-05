import { Link } from "react-router-dom";
import { homepageHero } from "../../../data/homepageMarketingContent";
import { ButtonLink } from "../../ui/Button";
import { Container } from "../../ui/Container";
import { HomeHeroVisual } from "./hero/HomeHeroVisual";
import { HomeMarketingHeroBackdrop } from "./HomeMarketingHeroBackdrop";

export function HomeMarketingHero() {
  return (
    <header className="hm-hero hm-hero--premium" aria-labelledby="hm-hero-heading">
      <div className="hm-hero-glow" aria-hidden />
      <HomeMarketingHeroBackdrop />
      <Container className="pg-container--marketing-wide hm-hero__container">
        <div className="hm-hero-grid">
          <div className="hm-hero-copy">
            <div className="hm-hero-copy-glass">
              <p className="hm-hero-eyebrow">
                <span className="hm-hero-eyebrow__text hm-hero-eyebrow__text--desktop">{homepageHero.eyebrow}</span>
                <span className="hm-hero-eyebrow__text hm-hero-eyebrow__text--mobile">{homepageHero.eyebrowMobile}</span>
              </p>
              <div className="hm-hero-title-wrap">
                <div className="hm-hero-headline-glow" aria-hidden />
                <h1 id="hm-hero-heading" className="hm-hero-title">
                  <span className="hm-hero-title__text hm-hero-title__text--desktop">{homepageHero.headline}</span>
                  <span className="hm-hero-title__text hm-hero-title__text--mobile">{homepageHero.headlineMobile}</span>
                </h1>
              </div>
              <p className="hm-hero-subtitle">{homepageHero.subheadline}</p>
              <div className="hm-hero-ctas">
                <ButtonLink
                  href={homepageHero.primaryCta.href}
                  variant="primary"
                  size="lg"
                  className="hm-hero-cta-btn"
                >
                  {homepageHero.primaryCta.label}
                </ButtonLink>
                <ButtonLink
                  href={homepageHero.secondaryCta.href}
                  variant="secondary"
                  size="lg"
                  className="hm-hero-cta-btn hm-hero-cta-btn--glass"
                >
                  {homepageHero.secondaryCta.label}
                </ButtonLink>
                <Link to={homepageHero.tertiaryCta.href} className="hm-hero-tertiary">
                  {homepageHero.tertiaryCta.label}
                </Link>
              </div>
              <ul className="hm-hero-feature-chips" aria-label="Key capabilities">
                {homepageHero.featureChips.map((chip) => (
                  <li key={chip} className="hm-hero-feature-chip">
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <HomeHeroVisual />
        </div>
      </Container>
      <div className="hm-hero-wave" aria-hidden>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false">
          <path
            d="M0,48 C360,88 720,0 1080,40 C1260,56 1380,64 1440,52 L1440,80 L0,80 Z"
            fill="var(--hm-stats-band-bg, #0f1420)"
          />
        </svg>
      </div>
    </header>
  );
}
