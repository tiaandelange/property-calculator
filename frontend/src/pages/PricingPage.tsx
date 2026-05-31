import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { ButtonLink } from "../components/ui/Button";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../services/subscriptionPlansSupabase";
import {
  isPopularPlan,
  planCta,
  planFeatureBullets,
  planPriceHeadline,
  planSecondaryCta
} from "../features/pricing/pricingPlanDisplay";

function ComparisonCell({ yes }: { yes: boolean }) {
  return (
    <td className="pg-pricing-compare__cell" data-yes={yes ? "true" : "false"}>
      {yes ? <Check size={16} aria-hidden /> : <span className="pg-pricing-compare__dash">—</span>}
    </td>
  );
}

function PricingCard({ plan }: { plan: SubscriptionPlanRecord }) {
  const popular = isPopularPlan(plan);
  const cta = planCta(plan);
  const secondary = planSecondaryCta(plan);
  const bullets = planFeatureBullets(plan);

  return (
    <article
      className={`pg-pricing-card${popular ? " pg-pricing-card--popular" : ""}`}
      aria-labelledby={`pricing-plan-${plan.code}`}
    >
      {popular ? <span className="pg-pricing-card__badge">Most Popular</span> : null}
      <h2 id={`pricing-plan-${plan.code}`} className="pg-pricing-card__name">
        {plan.name}
      </h2>
      {plan.description ? <p className="pg-pricing-card__desc">{plan.description}</p> : null}
      <p className="pg-pricing-card__price">{planPriceHeadline(plan)}</p>
      <ul className="pg-pricing-card__features">
        {bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="pg-pricing-card__actions">
        <ButtonLink href={cta.href} variant={cta.variant} fullWidth>
          {cta.label}
        </ButtonLink>
        {secondary ? (
          <Link to={secondary.href} className="pg-pricing-card__secondary-cta">
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>(FALLBACK_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listActiveSubscriptionPlans()
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch(() => {
        if (!cancelled) setPlans(FALLBACK_SUBSCRIPTION_PLANS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(() => [...plans].sort((a, b) => a.sortOrder - b.sortOrder), [plans]);

  return (
    <Section className="pg-pricing-page">
      <Helmet>
        <title>Pricing | Proplytic</title>
        <meta
          name="description"
          content="Choose a Proplytic plan for property portfolio management, reports, calculators and owner tools."
        />
      </Helmet>
      <Container className="pg-container--marketing-wide">
        <header className="pg-pricing-hero">
          <h1 className="pg-pricing-hero__title">Choose the plan that fits your property portfolio</h1>
          <p className="pg-pricing-hero__lead">
            Start with portfolio analytics, reports, invoices, statements and owner-management tools built for property
            investors.
          </p>
          <p className="pg-pricing-hero__note">
            Select a plan to create your account. Payment is not required yet — you will confirm billing later.
          </p>
        </header>

        {loading ? <p className="pg-muted pg-pricing-loading">Loading plans…</p> : null}

        <div className="pg-pricing-grid" role="list">
          {ordered.map((plan) => (
            <div key={plan.code} role="listitem">
              <PricingCard plan={plan} />
            </div>
          ))}
        </div>

        <div className="pg-pricing-compare-wrap">
          <h2 className="pg-pricing-compare__title">Compare plans</h2>
          <div className="pg-pricing-compare-scroll">
            <table className="pg-pricing-compare">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {ordered.map((p) => (
                    <th key={p.code} scope="col">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Monthly price</th>
                  {ordered.map((p) => (
                    <td key={p.code} className="pg-pricing-compare__cell pg-pricing-compare__cell--text">
                      {planPriceHeadline(p)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Properties</th>
                  {ordered.map((p) => (
                    <td key={p.code} className="pg-pricing-compare__cell pg-pricing-compare__cell--text">
                      {p.propertyLimit ?? "Unlimited"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Reports</th>
                  {ordered.map((p) => (
                    <td key={p.code} className="pg-pricing-compare__cell pg-pricing-compare__cell--text">
                      {p.includesUnlimitedReports || p.reportLimit == null ? "Unlimited" : p.reportLimit}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Calculators</th>
                  {ordered.map((p) => (
                    <ComparisonCell key={p.code} yes={p.includesCalculators} />
                  ))}
                </tr>
                <tr>
                  <th scope="row">Management software</th>
                  {ordered.map((p) => (
                    <ComparisonCell key={p.code} yes={p.includesManagement} />
                  ))}
                </tr>
                <tr>
                  <th scope="row">Free trial</th>
                  {ordered.map((p) => (
                    <td key={p.code} className="pg-pricing-compare__cell pg-pricing-compare__cell--text">
                      {p.trialDays > 0 ? `${p.trialDays} days` : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="pg-pricing-footer-note">
          Already have an account?{" "}
          <Link to="/login" className="pg-pricing-footer-note__link">
            Sign in
          </Link>
        </p>
      </Container>
    </Section>
  );
}
