import { Link } from "react-router-dom";
import { homepageHero } from "../../../data/homepageMarketingContent";
import { ButtonLink } from "../../ui/Button";
import { Container } from "../../ui/Container";
import { HomeMarketingHeroBackdrop } from "./HomeMarketingHeroBackdrop";
import { HomeMarketingHeroCubeCarousel } from "./HomeMarketingHeroCubeCarousel";

export function HomeMarketingHero() {
  return (
    <header className="hm-hero" aria-labelledby="hm-hero-heading">
      <div className="hm-hero-glow" aria-hidden />
      <HomeMarketingHeroBackdrop />
      <Container className="pg-container--marketing-wide hm-hero__container">
        <div className="hm-hero-grid">
          <div className="hm-hero-copy">
            <p className="hm-hero-eyebrow">
              <span className="hm-hero-eyebrow__text hm-hero-eyebrow__text--desktop">{homepageHero.eyebrow}</span>
              <span className="hm-hero-eyebrow__text hm-hero-eyebrow__text--mobile">{homepageHero.eyebrowMobile}</span>
            </p>
            <h1 id="hm-hero-heading" className="hm-hero-title">
              <span className="hm-hero-title__text hm-hero-title__text--desktop">{homepageHero.headline}</span>
              <span className="hm-hero-title__text hm-hero-title__text--mobile">{homepageHero.headlineMobile}</span>
            </h1>
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
                className="hm-hero-cta-btn"
              >
                {homepageHero.secondaryCta.label}
              </ButtonLink>
              <Link to={homepageHero.tertiaryCta.href} className="hm-hero-tertiary">
                {homepageHero.tertiaryCta.label}
              </Link>
            </div>
          </div>
          <div className="hm-hero-visual">
            <HomeMarketingHeroCubeCarousel />
          </div>
        </div>
      </Container>
    </header>
  );
}

