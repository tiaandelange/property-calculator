import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { ButtonLink } from "../components/ui/Button";
import { PricingComparisonTable } from "../features/pricing/PricingComparisonTable";
import {
  isPopularPlan,
  planCta,
  planFeatureBullets,
  planPriceHeadline,
  planSecondaryCta
} from "../features/pricing/pricingPlanDisplay";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../services/subscriptionPlansSupabase";

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
        if (!cancelled) setPlans(rows.length ? rows : FALLBACK_SUBSCRIPTION_PLANS);
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

        <PricingComparisonTable plans={ordered} />

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
