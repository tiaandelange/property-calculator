import { Check, Lock } from "lucide-react";
import { ButtonLink } from "../../components/ui/Button";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import {
  buildPricingComparisonRows,
  orderPlansForComparison,
  type ComparisonCellValue,
  type ComparisonRow,
  type PricingPlanCode
} from "./pricingComparisonMatrix";
import { type BillingPeriod, isPopularPlan, planCta, planSecondaryCta } from "./pricingPlanDisplay";

function CompareValue({ value }: { value: ComparisonCellValue }) {
  if (value.kind === "text") {
    return <span className="pg-pricing-compare__text">{value.text}</span>;
  }
  if (value.kind === "yes") {
    return (
      <span className="pg-pricing-compare__icon pg-pricing-compare__icon--yes" aria-label="Included">
        <Check size={18} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  return (
    <span className="pg-pricing-compare__icon pg-pricing-compare__icon--no" aria-label="Locked">
      <Lock size={17} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

function CompareCell({ value }: { value: ComparisonCellValue }) {
  return (
    <td className="pg-pricing-compare__cell">
      <CompareValue value={value} />
    </td>
  );
}

function PlanCtaCell({ plan }: { plan: SubscriptionPlanRecord }) {
  const cta = planCta(plan);
  const secondary = planSecondaryCta(plan);

  return (
    <td className="pg-pricing-compare__cell pg-pricing-compare__cell--cta">
      <div className="pg-pricing-compare__cta-stack">
        <ButtonLink href={cta.href} variant={cta.variant} size="sm" fullWidth>
          {cta.label}
        </ButtonLink>
        {secondary ? (
          <ButtonLink href={secondary.href} variant="ghost" size="sm" fullWidth>
            {secondary.label}
          </ButtonLink>
        ) : null}
      </div>
    </td>
  );
}

function MobileFeatureRow({
  row,
  plans
}: {
  row: ComparisonRow;
  plans: SubscriptionPlanRecord[];
}) {
  return (
    <article className="pg-pricing-compare-mobile__row">
      <h3 className="pg-pricing-compare-mobile__feature">{row.label}</h3>
      <ul className="pg-pricing-compare-mobile__plans">
        {plans.map((plan) => {
          const code = plan.code as PricingPlanCode;
          const value = row.values[code];
          return (
            <li key={plan.code} className="pg-pricing-compare-mobile__plan">
              <span className="pg-pricing-compare-mobile__plan-name">{plan.name}</span>
              <CompareValue value={value} />
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function PricingComparisonTable({
  plans,
  billingPeriod = "monthly"
}: {
  plans: SubscriptionPlanRecord[];
  billingPeriod?: BillingPeriod;
}) {
  const ordered = orderPlansForComparison(plans);
  const rows = buildPricingComparisonRows(plans, billingPeriod);

  if (!ordered.length) return null;

  return (
    <div className="pg-pricing-compare-wrap">
      <h2 className="pg-pricing-compare__title">Compare all features</h2>
      <p className="pg-pricing-compare__desc pg-muted">
        See what each plan includes — property limits, reports, analytics, and owner-management tools at a glance.
      </p>

      <div className="pg-pricing-compare-panel pg-pricing-compare-panel--desktop">
        <div className="pg-pricing-compare-scroll">
          <table className="pg-pricing-compare">
            <thead>
              <tr>
                <th scope="col" className="pg-pricing-compare__feature-col">
                  Feature
                </th>
                {ordered.map((plan) => (
                  <th
                    key={plan.code}
                    scope="col"
                    className={isPopularPlan(plan) ? "pg-pricing-compare__plan-col pg-pricing-compare__plan-col--popular" : "pg-pricing-compare__plan-col"}
                  >
                    {plan.name}
                    {isPopularPlan(plan) ? (
                      <span className="pg-pricing-compare__popular-tag">Most Popular</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="pg-pricing-compare__feature-col">
                    {row.label}
                  </th>
                  {ordered.map((plan) => (
                    <CompareCell key={plan.code} value={row.values[plan.code as PricingPlanCode]} />
                  ))}
                </tr>
              ))}
              <tr className="pg-pricing-compare__cta-row">
                <th scope="row" className="pg-pricing-compare__feature-col">
                  Get started
                </th>
                {ordered.map((plan) => (
                  <PlanCtaCell key={plan.code} plan={plan} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pg-pricing-compare-panel pg-pricing-compare-panel--mobile">
        <div className="pg-pricing-compare-mobile">
          {rows.map((row) => (
            <MobileFeatureRow key={row.id} row={row} plans={ordered} />
          ))}
          <article className="pg-pricing-compare-mobile__row pg-pricing-compare-mobile__row--cta">
            <h3 className="pg-pricing-compare-mobile__feature">Get started</h3>
            <ul className="pg-pricing-compare-mobile__plans">
              {ordered.map((plan) => {
                const cta = planCta(plan);
                const secondary = planSecondaryCta(plan);
                return (
                  <li key={plan.code} className="pg-pricing-compare-mobile__plan pg-pricing-compare-mobile__plan--cta">
                    <span className="pg-pricing-compare-mobile__plan-name">{plan.name}</span>
                    <div className="pg-pricing-compare__cta-stack">
                      <ButtonLink href={cta.href} variant={cta.variant} size="sm" fullWidth>
                        {cta.label}
                      </ButtonLink>
                      {secondary ? (
                        <ButtonLink href={secondary.href} variant="ghost" size="sm" fullWidth>
                          {secondary.label}
                        </ButtonLink>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>
      </div>

      <p className="pg-pricing-compare__footnote">
        Start free, upgrade when your portfolio needs deeper analytics and reporting.
      </p>
    </div>
  );
}
