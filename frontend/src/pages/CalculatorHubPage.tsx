import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ButtonLink } from "../components/ui/Button";
import { getHomepagePopularCalculatorCards } from "../data/homepageCalculators";
import { publicCalculatorLandingGroups } from "../data/publicCalculatorLandingGroups";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { CalculatorHubMortgageSection } from "../components/calculators/CalculatorHubMortgageSection";
import { CalculatorIconDisplay } from "../components/icons/CalculatorIconDisplay";

const UNDERSTANDING = [
  {
    title: "Monthly repayment",
    body: "The amount you pay the bank each month toward principal and interest (standard amortising loan)."
  },
  {
    title: "Total interest",
    body: "All interest charged over the full term if the rate stayed the same and you paid on schedule."
  },
  {
    title: "Total repayable",
    body: "Principal borrowed plus total interest — the full cash outflow over the loan term."
  },
  {
    title: "Outstanding balance",
    body: "What you still owe the bank at a point in time; it falls as each payment chips away at principal."
  }
] as const;

export function CalculatorHubPage() {
  const popular = getHomepagePopularCalculatorCards();

  return (
    <Section className="pg-calc-hub-page">
      <Helmet>
        <title>Property investment calculators | Proplytic</title>
        <meta
          name="description"
          content="Run quick property calculations before building your full portfolio report — bond payment, transfer costs, cash flow, cap rate, IRR and more. No sign-in required."
        />
      </Helmet>

      <Container className="pg-container pg-container--marketing-wide pg-calc-hub-intro">
        <h1 className="pg-h1 pg-calc-hub-page-title">Property Investment Calculators</h1>
        <p className="pg-lead pg-calc-hub-page-lead">
          Run quick property calculations before building your full portfolio report.
        </p>
      </Container>

      <CalculatorHubMortgageSection />

      <div className="pg-home-light-section pg-calc-hub-light">
        <Container className="pg-container pg-container--marketing-wide">
          <div className="pg-calc-hub-light-header">
            <h2 className="pg-h2 pg-calc-hub-light-title">More calculators</h2>
            <p className="pg-lead pg-calc-hub-light-lead">
              Each tool has its own page so you can bookmark, share and build a complete picture of a deal.
            </p>
          </div>

          <div className="pg-calc-hub-popular-grid" aria-label="Popular calculator links">
            {popular.map((c) => (
              <Link key={c.id} to={c.route} className="pg-calc-hub-popular-card">
                <CalculatorIconDisplay slug={c.templateKey} size="lg" className="pg-calc-hub-popular-icon" />
                <div className="pg-calc-hub-popular-body">
                  <div className="pg-calc-hub-popular-title">{c.title}</div>
                  <p className="pg-calc-hub-popular-desc">{c.shortDescription}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="pg-calc-hub-understand">
            <h2 className="pg-h2 pg-calc-hub-understand-title">Understanding your results</h2>
            <div className="pg-calc-hub-understand-grid">
              {UNDERSTANDING.map((u) => (
                <div key={u.title} className="pg-calc-hub-understand-card">
                  <div className="pg-calc-hub-understand-card-title">{u.title}</div>
                  <p className="pg-calc-hub-understand-card-body">{u.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pg-calc-hub-cta-strip">
            <p className="pg-calc-hub-cta-text">Ready to run more scenarios?</p>
            <ButtonLink href="#all-calculators" variant="primary">
              Browse all calculators
            </ButtonLink>
          </div>

          <div id="all-calculators" className="pg-calc-hub-all">
            <div className="pg-calc-hub-groups">
              {publicCalculatorLandingGroups.map((g) => (
                <div key={g.title} className="pg-calc-hub-group">
                  <h2 className="pg-calc-hub-group-title">{g.title}</h2>
                  <div className="pg-calc-hub-grid">
                    {g.items.map((item) =>
                      item.kind === "tool" ? (
                        <Link key={item.id} to={`/calculators/${item.slug}`} className="pg-calc-hub-card">
                          <Card>
                            <div className="pg-card-pad">
                              <CalculatorIconDisplay slug={item.slug} size="md" className="pg-calc-hub-card-icon" />
                              <div className="pg-card-title">{item.name}</div>
                              <p className="pg-lead pg-calc-hub-card-desc">{item.description}</p>
                              <span className="pg-calc-hub-card-cta">Open calculator</span>
                            </div>
                          </Card>
                        </Link>
                      ) : (
                        <div key={item.id} className="pg-calc-hub-card pg-calc-hub-card--soon" aria-disabled="true">
                          <Card>
                            <div className="pg-card-pad">
                              <div className="pg-card-title">{item.name}</div>
                              <p className="pg-lead pg-calc-hub-card-desc">{item.description}</p>
                              <span className="pg-calc-hub-card-cta pg-calc-hub-card-cta--muted">Coming soon</span>
                            </div>
                          </Card>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </div>
    </Section>
  );
}
