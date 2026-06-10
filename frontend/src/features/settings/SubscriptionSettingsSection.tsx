import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { Button, ButtonLink } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { SIGNUP_PLAN_CODES } from "../signup/signupPlan";
import { formatPlanPrice } from "../pricing/pricingPlanDisplay";
import { useSubscriptionDashboardQuery, useWorkspaceId } from "../queries";
import { queryKeys } from "../../lib/queryKeys";
import { updateUserSubscriptionPlanCode } from "../../services/userSubscriptionsSupabase";
import { usePlanPermissions } from "../../lib/subscription/usePlanPermissions";
import { PENDING_PAYMENT_BANNER_MESSAGE } from "../../lib/subscription/planFeatures";
import {
  isPaidCheckoutPlanCode,
  redirectToPlanCheckout,
  type PlanCheckoutCode
} from "../../lib/billing/planCheckout";
import { trackEvent } from "../../lib/analytics/analytics";
import {
  formatSubscriptionStatus,
  formatSubscriptionStatusBadgeClass,
  formatTrialEndDate,
  formatUsagePeriodRange,
  subscriptionHasPaymentProvider
} from "./subscriptionStatusDisplay";
import {
  planApplicationLinksLimitLabel,
  subscriptionDashboardFeatureRows,
  type SubscriptionFeatureRow
} from "./subscriptionDashboardFeatures";

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

function FeatureChecklist({ rows }: { rows: SubscriptionFeatureRow[] }) {
  if (!rows.length) return null;
  return (
    <ul className="pg-settings-subscription-features" aria-label="Plan features">
      {rows.map((row) => (
        <li
          key={row.key}
          className={`pg-settings-subscription-features__item${
            row.enabled ? "" : " pg-settings-subscription-features__item--locked"
          }`}
        >
          <span className="pg-settings-subscription-features__icon" aria-hidden>
            <AppIcon name={row.enabled ? "success" : "lock"} size="sm" />
          </span>
          <span>{row.label}</span>
          <span className="pg-settings-subscription-features__state">
            {row.enabled ? "Included" : "Locked"}
          </span>
        </li>
      ))}
    </ul>
  );
}

const ADMIN_TEST_PLANS = SIGNUP_PLAN_CODES;

type SubscriptionSettingsSectionProps = {
  freeUsesRemaining: number | null | undefined;
};

export function SubscriptionSettingsSection({ freeUsesRemaining }: SubscriptionSettingsSectionProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "ADMIN";
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error, refetch } = useSubscriptionDashboardQuery();
  const permissions = usePlanPermissions();
  const [changingCode, setChangingCode] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [planMessage, setPlanMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const autoCheckoutStarted = useRef(false);

  const subscription = data?.subscription ?? null;
  const plans = data?.plans ?? [];
  const usage = data?.usage;
  const selectedPlan =
    subscription != null ? plans.find((p) => p.code === subscription.planCode) : null;
  const effectivePlan = permissions.currentPlan;
  const isPendingPayment = permissions.isPendingPayment;

  const propertyLimit = permissions.limits.maxProperties;
  const reportLimit = permissions.limits.maxReportsPerMonth;
  const applicationLinkLimit = permissions.limits.maxApplicationLinks;

  const featureRows = subscriptionDashboardFeatureRows(effectivePlan ?? null, { isAdmin });

  const startCheckout = useCallback(
    async (planCode: string) => {
      const plan = plans.find((p) => p.code === planCode);
      if (!plan || !isPaidCheckoutPlanCode(plan.code, plan.monthlyPrice)) {
        setPlanMessage({ kind: "error", text: "This plan does not require checkout." });
        return;
      }

      setCheckoutLoading(true);
      setPlanMessage(null);
      trackEvent("complete_payment_click", {
        plan_code: plan.code,
        billing_period: "monthly",
        source_page: "/settings"
      });
      try {
        await redirectToPlanCheckout(plan.code as PlanCheckoutCode, "monthly");
      } catch (e) {
        setPlanMessage({
          kind: "error",
          text: e instanceof Error ? e.message : "Checkout failed. Make sure you are signed in."
        });
        setCheckoutLoading(false);
      }
    },
    [plans]
  );

  useEffect(() => {
    if (searchParams.get("checkout") !== "1") return;
    if (autoCheckoutStarted.current || !subscription || checkoutLoading) return;

    const planCodeParam = searchParams.get("plan")?.trim();
    const targetPlan = planCodeParam
      ? plans.find((p) => p.code === planCodeParam)
      : plans.find((p) => p.code === subscription.planCode);

    navigate("/settings?section=subscription", { replace: true });

    if (!targetPlan || !isPaidCheckoutPlanCode(targetPlan.code, targetPlan.monthlyPrice)) {
      return;
    }

    autoCheckoutStarted.current = true;
    void startCheckout(targetPlan.code);
  }, [searchParams, subscription, plans, checkoutLoading, navigate, startCheckout]);

  const showCompletePayment =
    isPendingPayment &&
    selectedPlan != null &&
    isPaidCheckoutPlanCode(selectedPlan.code, selectedPlan.monthlyPrice);
  const showUpgrade = subscription?.planCode === "starter" && !isPendingPayment;
  const showChangePlan =
    subscription != null && subscription.planCode !== "starter" && !isPendingPayment;

  const handleAdminSwitchPlan = async (planCode: string) => {
    const target = plans.find((p) => p.code === planCode);
    if (!target || subscription?.planCode === planCode) return;
    if (
      !window.confirm(
        `Switch your account to ${target.name} for internal testing? No payment will be collected.`
      )
    ) {
      return;
    }

    setChangingCode(planCode);
    setPlanMessage(null);
    try {
      await updateUserSubscriptionPlanCode(planCode, { requireAdmin: true });
      if (workspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.subscription(workspaceId) });
      }
      setPlanMessage({
        kind: "ok",
        text: `Plan updated to ${target.name}. Refresh gated pages to see feature changes.`
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
        {isPendingPayment ? (
          <>
            <strong>{PENDING_PAYMENT_BANNER_MESSAGE}</strong> You have Starter access until payment
            is confirmed
            {permissions.selectedPlanName ? ` for ${permissions.selectedPlanName}` : ""}.
          </>
        ) : (
          <>
            <strong>Billing checkout is available.</strong> Paid plans use secure checkout — no card is
            stored on this screen. Starter remains free with no payment step.
          </>
        )}
      </div>

      {isAdmin ? (
        <div className="pg-settings-subscription-admin-banner" role="status">
          <span className="pg-settings-badge pg-settings-badge--admin">Admin</span>
          <span className="pg-settings-subscription-admin-banner__text">
            You have unlimited access. Use the dev switcher below to test plan tiers.
          </span>
        </div>
      ) : null}

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
            Pick a Proplytic plan to unlock property limits and portfolio features.
          </p>
          <ButtonLink href="/pricing" variant="primary" size="sm">
            View plans
          </ButtonLink>
        </div>
      ) : (
        <>
          <div className="pg-settings-subscription-current">
            <div className="pg-settings-row">
              <div>
                <div className="pg-settings-row-label">Selected plan</div>
                <div className="pg-settings-row-desc">
                  {isPendingPayment
                    ? "Starter access until payment is confirmed"
                    : selectedPlan?.description ?? subscription.planCode}
                </div>
              </div>
              <span className="pg-settings-subscription-current__plan-name">
                {selectedPlan?.name ?? subscription.planCode}
              </span>
            </div>
            {isPendingPayment ? (
              <div className="pg-settings-row">
                <div>
                  <div className="pg-settings-row-label">Current access</div>
                  <div className="pg-settings-row-desc">
                    Starter limits apply until your payment is confirmed
                  </div>
                </div>
                <span>{effectivePlan?.name ?? "Starter"}</span>
              </div>
            ) : null}
            <div className="pg-settings-row">
              <div>
                <div className="pg-settings-row-label">Status</div>
                {subscriptionHasPaymentProvider(subscription) ? (
                  <div className="pg-settings-row-desc">Payment provider linked</div>
                ) : (
                  <div className="pg-settings-row-desc">Internal plan only — billing not connected</div>
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
                  <div className="pg-settings-row-desc">Access until trial end; not billed yet</div>
                </div>
                <span>{trialEndLabel}</span>
              </div>
            ) : null}
            {selectedPlan && !isPendingPayment ? (
              <>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Monthly price</div>
                  <span>{formatPlanPrice(selectedPlan.monthlyPrice, selectedPlan.currency)}</span>
                </div>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Property limit</div>
                  <span>
                    {propertyLimit == null
                      ? "Unlimited"
                      : `Up to ${propertyLimit} ${propertyLimit === 1 ? "property" : "properties"}`}
                  </span>
                </div>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Report limit (per month)</div>
                  <span>
                    {reportLimit == null ? "Unlimited" : `${reportLimit} reports`}
                  </span>
                </div>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Application link limit</div>
                  <span>{planApplicationLinksLimitLabel(selectedPlan)}</span>
                </div>
              </>
            ) : isPendingPayment && effectivePlan ? (
              <>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Monthly price (selected)</div>
                  <span>{formatPlanPrice(selectedPlan!.monthlyPrice, selectedPlan!.currency)}</span>
                </div>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Current property limit</div>
                  <span>
                    {propertyLimit == null
                      ? "Unlimited"
                      : `Up to ${propertyLimit} ${propertyLimit === 1 ? "property" : "properties"}`}
                  </span>
                </div>
                <div className="pg-settings-row">
                  <div className="pg-settings-row-label">Current report limit (per month)</div>
                  <span>{reportLimit == null ? "Unlimited" : `${reportLimit} reports`}</span>
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
              <UsageMeter label="Properties" used={usage.propertyCount} limit={propertyLimit} />
              <UsageMeter
                label="Reports generated"
                used={usage.investmentReportCount}
                limit={reportLimit}
              />
              <UsageMeter
                label="Active applicant links"
                used={usage.applicationLinksActive}
                limit={applicationLinkLimit}
              />
            </div>
          ) : null}

          <div className="pg-settings-subscription-features-panel">
            <h3 className="pg-settings-subscription-features-panel__title">
              {isPendingPayment ? "Current access (Starter)" : "Features on your plan"}
            </h3>
            <FeatureChecklist rows={featureRows} />
          </div>
        </>
      )}

      {planMessage ? (
        <div className={`pg-alert${planMessage.kind === "error" ? " pg-alert-error" : ""}`}>
          {planMessage.text}
        </div>
      ) : null}

      {isAdmin && subscription ? (
        <div className="pg-settings-subscription-admin-dev">
          <h3 className="pg-settings-subscription-admin-dev__title">Admin plan switcher (dev)</h3>
          <p className="pg-settings-subscription-admin-dev__hint">
            Updates your <code>user_subscriptions</code> row for testing gating. Service-role{" "}
            <code>set_user_plan(email, plan)</code> can assign plans to other users — see{" "}
            <code>docs/dev/SUBSCRIPTION_TEST_USERS.md</code>.
          </p>
          <div className="pg-settings-subscription-admin-dev__buttons" role="group" aria-label="Switch test plan">
            {ADMIN_TEST_PLANS.map((code) => {
              const plan = plans.find((p) => p.code === code);
              const isCurrent = subscription.planCode === code;
              return (
                <Button
                  key={code}
                  type="button"
                  variant={isCurrent ? "primary" : "secondary"}
                  size="sm"
                  disabled={isCurrent || changingCode != null}
                  loading={changingCode === code}
                  onClick={() => void handleAdminSwitchPlan(code)}
                >
                  {plan?.name ?? code}
                  {isCurrent ? " · current" : ""}
                </Button>
              );
            })}
          </div>
        </div>
      ) : !isAdmin ? (
        <div className="pg-settings-subscription-cta">
          {showCompletePayment ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={checkoutLoading}
              disabled={checkoutLoading}
              onClick={() => void startCheckout(subscription!.planCode)}
            >
              Complete payment
            </Button>
          ) : null}
          {showUpgrade ? (
            <ButtonLink href="/pricing" variant={showCompletePayment ? "secondary" : "primary"} size="sm">
              Upgrade
            </ButtonLink>
          ) : null}
          {showChangePlan ? (
            <ButtonLink href="/pricing" variant="secondary" size="sm">
              Change plan
            </ButtonLink>
          ) : null}
          {!subscription ? (
            <ButtonLink href="/pricing" variant="primary" size="sm">
              View plans
            </ButtonLink>
          ) : null}
          <p className="pg-settings-subscription-cta__hint">
            {showCompletePayment
              ? "Finish checkout to activate your paid plan. You can compare tiers on the pricing page."
              : "Compare tiers on the pricing page or complete checkout when you are ready to upgrade."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
