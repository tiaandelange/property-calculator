import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { calculators } from "../data/calculators";
import { groupCalculators } from "../data/calculatorHubGroups";
import { getHomepagePopularCalculatorCards } from "../data/homepageCalculators";
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
  const groups = groupCalculators(calculators);
  const popular = getHomepagePopularCalculatorCards();

  return (
    <Section className="pg-calc-hub-page">
      <Helmet>
        <title>Mortgage calculator &amp; property calculators | The Property Guy</title>
        <meta
          name="description"
          content="Calculate monthly bond repayments with sliders, then open dedicated calculators for transfer costs, affordability, rental yield, IRR and more — each on its own page for clear results."
        />
      </Helmet>

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
            <a href="#all-calculators" className="pg-btn pg-btn-primary">
              Browse all calculators
            </a>
          </div>

          <div id="all-calculators" className="pg-calc-hub-all">
            <div className="pg-calc-hub-groups">
            {groups.map((g) => (
              <div key={g.title} className="pg-calc-hub-group">
                <h2 className="pg-calc-hub-group-title">{g.title}</h2>
                <div className="pg-calc-hub-grid">
                  {g.items.map((c) => (
                    <Link key={c.slug} to={`/calculators/${c.slug}`} className="pg-calc-hub-card">
                      <Card>
                        <div className="pg-card-pad">
                          <div className="pg-card-title">{c.name}</div>
                          <p className="pg-lead" style={{ margin: 0, fontSize: 14 }}>
                            {c.description}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  ))}
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
