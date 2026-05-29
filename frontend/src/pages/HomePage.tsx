import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { ButtonLink } from "../components/ui/Button";
import { getHomepagePopularCalculatorCards } from "../data/homepageCalculators";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Grid } from "../components/ui/Grid";
import { HomeCalculatorIcon } from "../components/home/HomeCalculatorIcon";
import { HomeFeaturesBenefitsSection } from "../components/home/HomeFeaturesBenefitsSection";
import { HomeTestimonialsSection } from "../components/home/HomeTestimonialsSection";
import { HomeFinalCtaSection } from "../components/home/HomeFinalCtaSection";
import { HomeQuickCalculationStartSection } from "../components/home/HomeQuickCalculationStartSection";
import { HomeTrustStatsStrip } from "../components/home/HomeTrustStatsStrip";
import { HomeCalculatorPreviewDemoSection } from "../components/home/HomeCalculatorPreviewDemoSection";
import { HomeHeroFloatingLauncher } from "../components/home/HomeHeroFloatingLauncher";
import { HomeHeroVisual } from "../components/home/HomeHeroVisual";

export function HomePage() {
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [location.hash, location.pathname]);

  const popularCalculatorCards = useMemo(() => getHomepagePopularCalculatorCards(), []);

  return (
    <>
      <Helmet>
        <title>The Property Guy | South Africa Property Calculators</title>
        <meta
          name="description"
          content="A modern set of South African property investment calculators for investors: cash flow, NOI, cap rate, DSCR, IRR and more."
        />
      </Helmet>

      <div className="pg-home" id="home">
      <div className="pg-home-hero">
        <div className="pg-home-hero-base" aria-hidden="true" />
        <Container className="pg-container--marketing-wide">
          <div className="pg-home-hero-grid">
            <div className="pg-home-hero-col pg-home-hero-col--copy">
              <div className="pg-home-hero-copy-inner">
                <div className="pg-home-eyebrow">Property calculators built for real decisions</div>
                <h1 className="pg-home-h1">
                  Smart property decisions <span className="pg-home-h1-em">start here.</span>
                </h1>
                <p className="pg-home-hero-sub">
                  Powerful calculators and clear insights to help you buy, sell and invest with confidence.
                </p>
                <div className="pg-home-hero-actions">
                  <ButtonLink href="/calculators" variant="primary" aria-label="Explore calculators">
                    Explore calculators
                  </ButtonLink>
                  <ButtonLink href="/#how-it-works" variant="ghost" aria-label="See how it works">
                    See how it works
                  </ButtonLink>
                </div>
              </div>
            </div>
            <div className="pg-home-hero-col pg-home-hero-col--visual">
              <HomeHeroVisual />
            </div>
          </div>
        </Container>
      </div>

      <div className="pg-home-launcher-bridge">
        <Container className="pg-container--marketing-wide">
          <HomeHeroFloatingLauncher />
        </Container>
      </div>

      <HomeQuickCalculationStartSection />

      <HomeTrustStatsStrip />

      {/* 4. Popular calculators grid */}
      <Section id="popular-calculators" className="pg-home-light-section">
        <Container className="pg-container--marketing-wide">
          <h2 className="pg-h2">Popular calculators</h2>
          <p className="pg-lead">Clean, practical tools for South African property decisions.</p>
          <Grid cols={4}>
            {popularCalculatorCards.map((c) => (
              <Link
                key={c.id}
                to={c.route}
                className="pg-home-quick-card pg-home-light-card pg-home-quick-card--with-icon"
              >
                <HomeCalculatorIcon slug={c.templateKey} label={c.title} />
                <div>
                  <div className="pg-home-quick-title">{c.title}</div>
                  <div className="pg-home-quick-desc">{c.shortDescription}</div>
                  <div className="pg-home-quick-desc" style={{ marginTop: 6, fontWeight: 900 }}>
                    Open →
                  </div>
                </div>
              </Link>
            ))}
          </Grid>
        </Container>
      </Section>

      <HomeCalculatorPreviewDemoSection />

      <HomeFeaturesBenefitsSection />

      <HomeTestimonialsSection />

      <HomeFinalCtaSection />

      </div>
    </>
  );
}

