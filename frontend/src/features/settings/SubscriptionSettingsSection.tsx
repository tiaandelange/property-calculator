import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ButtonLink } from "../../components/ui/Button";
import {
  formatPlanPrice,
  planFeatureBullets,
  planPriceHeadline,
  planPropertyLimitLabel,
  planReportLimitLabel
} from "../pricing/pricingPlanDisplay";
import { useSubscriptionDashboardQuery, useWorkspaceId } from "../queries";
import { queryKeys } from "../../lib/queryKeys";
import { updateUserSubscriptionPlanCode } from "../../services/userSubscriptionsSupabase";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import {
  formatSubscriptionStatus,
  formatSubscriptionStatusBadgeClass,
  formatTrialEndDate,
  formatUsagePeriodRange,
  subscriptionHasPaymentProvider
} from "./subscriptionStatusDisplay";

function UsageMeter({
  label,
  used,
  limit
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const unlimited = limit == null;
  const atLimit = !unlimited && used >= limit;
  return (
    <div className="pg-settings-subscription-usage-row">
      <div>
        <div className="pg-settings-row-label">{label}</div>
        <div className="pg-settings-row-desc">
          {unlimited ? `${used} used · unlimited` : `${used} of ${limit} used`}
        </div>
      </div>
      {atLimit ? (
        <span className="pg-settings-badge pg-settings-badge--muted">At limit</span>
      ) : (
        <span className="pg-settings-badge">{unlimited ? "Unlimited" : "Within limit"}</span>
      )}
    </div>
  );
}

function PlanPickerCard({
  plan,
  isCurrent,
  changing,
  onChangePlan
}: {
  plan: SubscriptionPlanRecord;
  isCurrent: boolean;
  changing: boolean;
  onChangePlan: (code: string) => void;
}) {
  const bullets = planFeatureBullets(plan);
  return (
    <article
      className={`pg-settings-subscription-plan${isCurrent ? " pg-settings-subscription-plan--current" : ""}`}
      aria-current={isCurrent ? "true" : undefined}
    >
      {isCurrent ? <span className="pg-settings-subscription-plan__tag">Current plan</span> : null}
      <h3 className="pg-settings-subscription-plan__name">{plan.name}</h3>
      <p className="pg-settings-subscription-plan__price">{planPriceHeadline(plan)}</p>
      <ul className="pg-settings-subscription-plan__features">
        {bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {isCurrent ? (
        <Button variant="outline" size="sm" fullWidth disabled>
          Current plan
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          loading={changing}
          disabled={changing}
          onClick={() => onChangePlan(plan.code)}
        >
          Change plan
        </Button>
      )}
    </article>
  );
}

type SubscriptionSettingsSectionProps = {
  freeUsesRemaining: number | null | undefined;
};

export function SubscriptionSettingsSection({ freeUsesRemaining }: SubscriptionSettingsSectionProps) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useSubscriptionDashboardQuery();
  const [changingCode, setChangingCode] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const subscription = data?.subscription ?? null;
  const plans = data?.plans ?? [];
  const usage = data?.usage;
  const currentPlan =
    subscription != null ? plans.find((p) => p.code === subscription.planCode) : null;

  const handleChangePlan = async (planCode: string) => {
    if (!subscription) {
      setPlanMessage({
        kind: "error",
        text: "No subscription record yet. Choose a plan from pricing and sign up, or contact support."
      });
      return;
    }
    const target = plans.find((p) => p.code === planCode);
    if (!target) return;
    if (
      !window.confirm(
        `Switch to ${target.name} for internal testing only? No payment will be collected. Payment processing is coming soon.`
      )
    ) {
      return;
    }

    setChangingCode(planCode);
    setPlanMessage(null);
    try {
      await updateUserSubscriptionPlanCode(planCode);
      if (workspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.subscription(workspaceId) });
      }
      setPlanMessage({
        kind: "ok",
        text: `Plan updated to ${target.name}. Billing is not active yet — this change is for testing only.`
      });
    } catch (e) {
      setPlanMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not update plan."
      });
    } finally {
      setChangingCode(null);
    }
  };

  if (isLoading) {
    return <div className="pg-settings-skeleton" style={{ minHeight: 200 }} aria-busy="true" />;
  }

  if (error) {
    return (
      <div className="pg-alert pg-alert-error">
        {error instanceof Error ? error.message : "Could not load subscription."}{" "}
        <button type="button" className="pg-link-button" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const trialEndLabel =
    subscription?.status === "trialing" ? formatTrialEndDate(subscription.trialEnd) : null;

  return (
    <div className="pg-settings-subscription">
      <div className="pg-settings-subscription-notice" role="status">
        <strong>Payment processing coming soon.</strong> Plan changes update your internal subscription
        record only and do not charge a card. Manage billing will activate when payments are connected.
      </div>

      {!subscription ? (
        <div className="pg-settings-subscription-legacy">
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Calculator access</div>
              <div className="pg-settings-row-desc">
                {freeUsesRemaining == null
                  ? "Unlimited calculator reports (subscribed profile)."
                  : `${freeUsesRemaining} free calculator reports remaining.`}
              </div>
            </div>
            <span className="pg-settings-badge pg-settings-badge--muted">Legacy profile</span>
          </div>
          <p className="pg-settings-subscription-legacy__hint">
            Pick a Proplytic plan to unlock property limits and portfolio features.{" "}
            <Link to="/pricing">View plans</Link>
          </p>
        </div>
      ) : (
        <>
          <div className="pg-settings-subscription-current">
            <div className="pg-settings-row">
              <div>
                <div className="pg-settings-row-label">Current plan</div>
                <div className="pg-settings-row-desc">
                  {currentPlan?.description ?? subscription.planCode}
                </div>
              </div>
              <span className="pg-settings-subscription-current__plan-name">
                {currentPlan?.name ?? subscription.planCode}
              </span>
            </div>
            <div className="pg-settings-row">
              <div>
                <div className="pg-settings-row-label">Status</div>
                {subscriptionHasPaymentProvider(subscription) ? (
                  <div className="pg-settings-row-desc">Payment provider linked</div>
                ) : (
                  <div className="pg-settings-row-desc">No payment provider on file</div>
                )}
              </div>
              <span className={formatSubscriptionStatusBadgeClass(subscription.status)}>
                {formatSubscriptionStatus(subscription.status)}
              </span>
            </div>
            {trialEndLabel ? (
              <div className="pg-settings-row">
                <div>
                  <div className="pg-settings-row-label">Trial ends</div>
                  <div className="pg-settings-row-desc">Access continues until trial end; billing not charged yet</div>
                </div>
                <span>{trialEndLabel}</span>
              </div>
            ) : null}
            {currentPlan ? (
              <>
                <div className="pg-settings-row">
                  <div>
                    <div className="pg-settings-row-label">Monthly price</div>
                  </div>
                  <span>{formatPlanPrice(currentPlan.monthlyPrice, currentPlan.currency)}</span>
                </div>
                <div className="pg-settings-row">
                  <div>
                    <div className="pg-settings-row-label">Property limit</div>
                  </div>
                  <span>{planPropertyLimitLabel(currentPlan)}</span>
                </div>
                <div className="pg-settings-row">
                  <div>
                    <div className="pg-settings-row-label">Report limit</div>
                  </div>
                  <span>{planReportLimitLabel(currentPlan)}</span>
                </div>
              </>
            ) : null}
          </div>

          {usage ? (
            <div className="pg-settings-subscription-usage">
              <h3 className="pg-settings-subscription-usage__title">Current usage</h3>
              <p className="pg-settings-subscription-usage__period">
                {usage.period.label}: {formatUsagePeriodRange(usage.period)}
              </p>
              <UsageMeter
                label="Properties"
                used={usage.propertyCount}
                limit={currentPlan?.propertyLimit ?? null}
              />
              <UsageMeter
                label="Investment reports (PDF)"
                used={usage.investmentReportCount}
                limit={
                  currentPlan?.includesUnlimitedReports ? null : (currentPlan?.reportLimit ?? null)
                }
              />
            </div>
          ) : null}
        </>
      )}

      <div className="pg-settings-actions pg-settings-subscription-actions">
        <Button variant="outline" size="sm" disabled title="Available when payment processing launches">
          Upgrade
        </Button>
        <Button variant="outline" size="sm" disabled title="Available when payment processing launches">
          Downgrade
        </Button>
        <Button variant="outline" size="sm" disabled title="Billing portal coming soon">
          Manage billing
        </Button>
        <ButtonLink href="/pricing" variant="ghost" size="sm">
          Compare plans
        </ButtonLink>
      </div>

      {planMessage ? (
        <div className={`pg-alert${planMessage.kind === "error" ? " pg-alert-error" : ""}`}>{planMessage.text}</div>
      ) : null}

      {subscription && plans.length > 0 ? (
        <div className="pg-settings-subscription-plans">
          <h3 className="pg-settings-subscription-plans__title">All plans</h3>
          <div className="pg-settings-subscription-plans__grid">
            {plans.map((plan) => (
              <PlanPickerCard
                key={plan.code}
                plan={plan}
                isCurrent={plan.code === subscription.planCode}
                changing={changingCode === plan.code}
                onChangePlan={handleChangePlan}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
