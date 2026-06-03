import { Link } from "react-router-dom";
import { homepageHero } from "../../../data/homepageMarketingContent";
import { ButtonLink } from "../../ui/Button";
import { Container } from "../../ui/Container";
import { HomeMarketingHeroAppPreview } from "./HomeMarketingHeroAppPreview";

export function HomeMarketingHero() {
  return (
    <header className="hm-hero" aria-labelledby="hm-hero-heading">
      <div className="hm-hero-glow" aria-hidden />
      <Container className="pg-container--marketing-wide hm-hero__container">
        <div className="hm-hero-grid">
          <div className="hm-hero-copy">
            <p className="hm-hero-eyebrow">{homepageHero.eyebrow}</p>
            <h1 id="hm-hero-heading" className="hm-hero-title">
              {homepageHero.headline}
            </h1>
            <p className="hm-hero-subtitle">{homepageHero.subheadline}</p>
            <div className="hm-hero-ctas">
              <ButtonLink href={homepageHero.primaryCta.href} variant="primary" size="lg">
                {homepageHero.primaryCta.label}
              </ButtonLink>
              <ButtonLink href={homepageHero.secondaryCta.href} variant="secondary" size="lg">
                {homepageHero.secondaryCta.label}
              </ButtonLink>
              <Link to={homepageHero.tertiaryCta.href} className="hm-hero-tertiary">
                {homepageHero.tertiaryCta.label}
              </Link>
            </div>
          </div>
          <div className="hm-hero-visual">
            <HomeMarketingHeroAppPreview />
          </div>
        </div>
      </Container>
    </header>
  );
}
