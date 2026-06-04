import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PublicPageSeo } from "../components/seo/PublicPageSeo";
import { PRICING_PAGE_SEO } from "../lib/publicPageSeo";
import { Check } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { ButtonLink } from "../components/ui/Button";
import { PricingComparisonTable } from "../features/pricing/PricingComparisonTable";
import { PricingFaqSection } from "../features/pricing/PricingFaqSection";
import {
  pricingFinalCta,
  pricingHero,
  pricingRecommendations,
  pricingValueChips,
  pricingValueStripLead
} from "../data/pricingPageContent";
import {
  isPopularPlan,
  planBestFor,
  planCardFeatureLines,
  planCta,
  planPriceHeadline,
  planPriceSubline,
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
  const features = planCardFeatureLines(plan);
  const subline = planPriceSubline(plan);

  return (
    <article
      className={`pg-pricing-card${popular ? " pg-pricing-card--popular" : ""}`}
      aria-labelledby={`pricing-plan-${plan.code}`}
    >
      {popular ? <span className="pg-pricing-card__badge">Most Popular</span> : null}
      <h2 id={`pricing-plan-${plan.code}`} className="pg-pricing-card__name">
        {plan.name}
      </h2>
      <p className="pg-pricing-card__best-for">
        <span className="pg-pricing-card__best-for-label">Best for:</span> {planBestFor(plan)}
      </p>
      <div className="pg-pricing-card__price-block">
        <p className="pg-pricing-card__price">{planPriceHeadline(plan)}</p>
        {subline ? <p className="pg-pricing-card__price-sub">{subline}</p> : null}
      </div>
      <ul className="pg-pricing-card__features">
        {features.map((line) => (
          <li key={line}>
            <Check className="pg-pricing-card__check" size={16} strokeWidth={2.5} aria-hidden />
            <span>{line}</span>
          </li>
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
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

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
      <PublicPageSeo seo={PRICING_PAGE_SEO} />
      <Container className="pg-container--marketing-wide">
        <header className="pg-pricing-hero">
          <h1 className="pg-pricing-hero__title">{pricingHero.title}</h1>
          <p className="pg-pricing-hero__lead">{pricingHero.lead}</p>
          <p className="pg-pricing-hero__trust">{pricingHero.trustLine}</p>

          <div className="pg-pricing-billing-toggle" role="group" aria-label="Billing period">
            <button
              type="button"
              className={`pg-pricing-billing-toggle__btn${billingPeriod === "monthly" ? " pg-pricing-billing-toggle__btn--active" : ""}`}
              aria-pressed={billingPeriod === "monthly"}
              onClick={() => setBillingPeriod("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className="pg-pricing-billing-toggle__btn pg-pricing-billing-toggle__btn--disabled"
              disabled
              aria-pressed={false}
              title="Annual billing coming soon"
            >
              Annual
              <span className="pg-pricing-billing-toggle__soon">Coming soon</span>
            </button>
          </div>

          <p className="pg-pricing-hero__note">{pricingHero.paymentNote}</p>
        </header>

        {loading ? <p className="pg-muted pg-pricing-loading">Loading plans…</p> : null}

        <div className="pg-pricing-grid" role="list">
          {ordered.map((plan) => (
            <div key={plan.code} role="listitem">
              <PricingCard plan={plan} />
            </div>
          ))}
        </div>

        <div className="pg-pricing-value-strip">
          <p className="pg-pricing-value-strip__lead">{pricingValueStripLead}</p>
          <ul className="pg-pricing-value-strip__chips">
            {pricingValueChips.map((chip) => (
              <li key={chip.id} className="pg-pricing-value-chip">
                <span className="pg-pricing-value-chip__label">{chip.label}</span>
                <span className="pg-pricing-value-chip__detail">{chip.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div id="pricing-compare">
          <PricingComparisonTable plans={ordered} />
        </div>

        <section className="pg-pricing-recommend" aria-labelledby="pricing-recommend-heading">
          <h2 id="pricing-recommend-heading" className="pg-pricing-section-title">
            Which plan should I choose?
          </h2>
          <ul className="pg-pricing-recommend__list">
            {pricingRecommendations.map((item) => (
              <li key={item.plan} className="pg-pricing-recommend__item">
                <strong>Choose {item.plan} if:</strong> {item.body}
              </li>
            ))}
          </ul>
        </section>

        <PricingFaqSection />

        <section className="pg-pricing-final-cta" aria-labelledby="pricing-final-cta-heading">
          <h2 id="pricing-final-cta-heading" className="pg-pricing-final-cta__title">
            {pricingFinalCta.title}
          </h2>
          <p className="pg-pricing-final-cta__lead">{pricingFinalCta.lead}</p>
          <div className="pg-pricing-final-cta__actions">
            <ButtonLink href={pricingFinalCta.primary.href} variant="primary" size="lg">
              {pricingFinalCta.primary.label}
            </ButtonLink>
            <ButtonLink href={pricingFinalCta.secondary.href} variant="secondary" size="lg">
              {pricingFinalCta.secondary.label}
            </ButtonLink>
          </div>
        </section>

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
