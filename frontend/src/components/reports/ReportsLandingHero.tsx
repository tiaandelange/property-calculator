import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { MARKETING_SIGNUP_FREE_HREF } from "../../data/homepageMarketingContent";
import { IconContainerByName } from "../icons";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { ReportsLandingHeroBackdrop } from "./ReportsLandingHeroBackdrop";
import { ReportsLandingHeroMockup } from "./ReportsLandingHeroMockup";

const FEATURES = [
  {
    icon: "reports" as const,
    title: "Professional layouts",
    description: "Presentation-ready PDF designs"
  },
  {
    icon: "portfolio" as const,
    title: "Data-linked outputs",
    description: "Reports built from your property, lease and financial data"
  },
  {
    icon: "download" as const,
    title: "Export-ready",
    description: "Download, share or archive reports when signed in"
  }
] as const;

const SAMPLE_PREVIEW_ID = "sample-report-preview";

function scrollToSamplePreview() {
  document.getElementById(SAMPLE_PREVIEW_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ReportsLandingHero() {
  return (
    <header className="pg-reports-hub-landing-hero" aria-labelledby="reports-hub-landing-hero-heading">
      <div className="pg-reports-hub-landing-hero__glow pg-reports-hub-landing-hero__glow--copy" aria-hidden />
      <div className="pg-reports-hub-landing-hero__glow pg-reports-hub-landing-hero__glow--visual" aria-hidden />
      <ReportsLandingHeroBackdrop />
      <Container className="pg-container pg-container--marketing-wide pg-reports-hub-landing-hero__container">
        <div className="pg-reports-hub-landing-hero__grid">
          <div className="pg-reports-hub-landing-hero__copy">
            <p className="pg-reports-hub-landing-hero__badge">
              <FileText size={14} strokeWidth={2.25} aria-hidden />
              <span>Investor-ready PDF reports</span>
            </p>
            <h1 id="reports-hub-landing-hero-heading" className="pg-reports-hub-landing-hero__title">
              <span className="pg-visually-hidden">Investor-Ready PDF Reports for Property Owners</span>
              <span className="pg-reports-hub-landing-hero__title-visible">
                Turn property data into{" "}
                <span className="pg-reports-hub-landing-hero__accent">investor-ready PDF reports.</span>
              </span>
            </h1>
            <p className="pg-reports-hub-landing-hero__subtitle">
              Generate polished portfolio summaries, cash flow packs, property analysis PDFs, invoices and tenant
              statements from one connected workspace.
            </p>
            <div className="pg-reports-hub-landing-hero__ctas">
              <Button type="button" variant="primary" onClick={scrollToSamplePreview}>
                View Sample Report
              </Button>
              <Link to={MARKETING_SIGNUP_FREE_HREF} className="pg-btn pg-btn--secondary pg-reports-hub-landing-hero__cta-secondary">
                Start Free
              </Link>
            </div>
            <ul className="pg-reports-hub-landing-hero__features" aria-label="Report highlights">
              {FEATURES.map((feature) => (
                <li key={feature.title}>
                  <IconContainerByName icon={feature.icon} accent="purple" size="sm" />
                  <div>
                    <span className="pg-reports-hub-landing-hero__feature-title">{feature.title}</span>
                    <span className="pg-reports-hub-landing-hero__feature-desc">{feature.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ReportsLandingHeroMockup />
        </div>
      </Container>
      <div className="pg-reports-hub-landing-hero__wave" aria-hidden>
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
