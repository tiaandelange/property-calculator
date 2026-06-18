import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { SIGNUP_PLAN_CODES } from "../signup/signupPlan";
import { formatPlanPrice, planMarketingName } from "../pricing/pricingPlanDisplay";
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
  subscriptionDashboardFeatureRows,
  type SubscriptionFeatureRow
} from "./subscriptionDashboardFeatures";
import { ChangePlanModal } from "./ChangePlanModal";
import { SettingsAccordion } from "./components/SettingsAccordion";
import { SettingsCard } from "./components/SettingsCard";
import { SettingsSectionStack } from "./components/SettingsSectionStack";
import { SettingsRow } from "./SettingsRow";
import { StorageUsageCard } from "./StorageUsageCard";

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
    <SettingsRow label={label}>
      <div className="pg-settings-panel-inline-actions">
        <span className="pg-settings-panel-value">
          {unlimited ? `${used} · unlimited` : `${used} / ${limit}`}
        </span>
        <span className={`pg-settings-badge${atLimit ? " pg-settings-badge--muted" : ""}`}>
          {atLimit ? "At limit" : unlimited ? "Unlimited" : "OK"}
        </span>
      </div>
    </SettingsRow>
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

export function SubscriptionSettingsSection({ freeUsesRemaining: _freeUsesRemaining }: SubscriptionSettingsSectionProps) {
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
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [planMessage, setPlanMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const autoCheckoutStarted = useRef(false);

  const subscription = data?.subscription ?? null;
  const plans = data?.plans ?? [];
  const usage = data?.usage;
  const selectedPlan =
    subscription != null ? plans.find((p) => p.code === subscription.planCode) : null;
  const effectivePlan = permissions.currentPlan ?? selectedPlan ?? plans.find((p) => p.code === "starter") ?? null;
  const isPendingPayment = permissions.isPendingPayment;
  const displayPlanName = effectivePlan ? planMarketingName(effectivePlan) : "Free";
  const displayStatus = subscription?.status ?? "active";

  const propertyLimit = permissions.limits.maxProperties;
  const reportLimit = permissions.limits.maxReportsPerMonth;
  const applicationLinkLimit = permissions.limits.maxApplicationLinks;

  const featureRows = subscriptionDashboardFeatureRows(effectivePlan ?? null, { isAdmin });

  const startCheckout = useCallback(
    async (planCode: string, billingPeriod: "monthly" | "annual" = "monthly") => {
      const plan = plans.find((p) => p.code === planCode);
      if (!plan || !isPaidCheckoutPlanCode(plan.code, plan.monthlyPrice)) {
        setPlanMessage({ kind: "error", text: "This plan does not require checkout." });
        return;
      }

      setCheckoutLoading(true);
      setPlanMessage(null);
      trackEvent("complete_payment_click", {
        plan_code: plan.code,
        billing_period: billingPeriod,
        source_page: "/settings"
      });
      try {
        await redirectToPlanCheckout(plan.code as PlanCheckoutCode, billingPeriod);
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
    if (autoCheckoutStarted.current || checkoutLoading) return;

    const planCodeParam = searchParams.get("plan")?.trim();
    const targetPlan = planCodeParam
      ? plans.find((p) => p.code === planCodeParam)
      : subscription
        ? plans.find((p) => p.code === subscription.planCode)
        : null;

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
  const renewalLabel =
    subscription?.currentPeriodEnd && !isPendingPayment
      ? formatTrialEndDate(subscription.currentPeriodEnd)
      : null;
  const monthlyPrice =
    isPendingPayment && selectedPlan
      ? selectedPlan.monthlyPrice
      : (effectivePlan?.monthlyPrice ?? 0);
  const monthlyCurrency = effectivePlan?.currency ?? selectedPlan?.currency ?? "ZAR";

  const usageSummary = usage
    ? `${usage.propertyCount} properties · ${usage.investmentReportCount} reports`
    : undefined;

  const featuresTitle = isPendingPayment ? "Current access (Free)" : "Features on your plan";
  const featuresIncluded = featureRows.filter((row) => row.enabled).length;
  const featuresSummary =
    featureRows.length > 0 ? `${featuresIncluded} of ${featureRows.length} included` : undefined;

  return (
    <SettingsSectionStack className="pg-settings-subscription">
      <div className="pg-settings-subscription-notice" role="status">
        {isPendingPayment ? (
          <>
            <strong>{PENDING_PAYMENT_BANNER_MESSAGE}</strong> You have Free plan access until payment
            is confirmed
            {permissions.selectedPlanName ? ` for ${permissions.selectedPlanName}` : ""}.
          </>
        ) : (
          <>
            <strong>Your plan:</strong> {displayPlanName} · {formatSubscriptionStatus(displayStatus)}
            {subscriptionHasPaymentProvider(subscription) ? " · Billing connected" : ""}
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

      <SettingsCard className="pg-settings-subscription-current">
        <div className="pg-settings-panel-rows">
          <SettingsRow label="Current plan">
            <span className="pg-settings-panel-value pg-settings-subscription-current__plan-name">
              {displayPlanName}
            </span>
          </SettingsRow>

          {isPendingPayment ? (
            <SettingsRow label="Selected paid plan">
              <span className="pg-settings-panel-value">
                {permissions.selectedPlanName ?? selectedPlan?.name ?? "—"}
              </span>
            </SettingsRow>
          ) : null}

          <SettingsRow label="Status">
            <span className={formatSubscriptionStatusBadgeClass(displayStatus)}>
              {formatSubscriptionStatus(displayStatus)}
            </span>
          </SettingsRow>

          {trialEndLabel ? (
            <SettingsRow label="Trial ends">
              <span className="pg-settings-panel-value">{trialEndLabel}</span>
            </SettingsRow>
          ) : null}

          {renewalLabel ? (
            <SettingsRow label="Renewal date">
              <span className="pg-settings-panel-value">{renewalLabel}</span>
            </SettingsRow>
          ) : null}

          <SettingsRow label="Price">
            <span className="pg-settings-panel-value">
              {formatPlanPrice(monthlyPrice, monthlyCurrency)}
            </span>
          </SettingsRow>
        </div>
      </SettingsCard>

      {usage ? (
        <SettingsAccordion title="Current usage" summary={usageSummary} defaultOpen={false}>
          <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
            <p className="pg-settings-panel-muted pg-settings-panel-muted--nested">
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
        </SettingsAccordion>
      ) : null}

      {featureRows.length > 0 ? (
        <SettingsAccordion title={featuresTitle} summary={featuresSummary} defaultOpen={false}>
          <FeatureChecklist rows={featureRows} />
        </SettingsAccordion>
      ) : null}

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
                  {plan ? planMarketingName(plan) : code}
                  {isCurrent ? " · current" : ""}
                </Button>
              );
            })}
          </div>
        </div>
      ) : !isAdmin ? (
        <SettingsCard className="pg-settings-subscription-actions">
          <div className="pg-settings-panel-rows">
            {showCompletePayment ? (
              <SettingsRow label="Complete payment">
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
              </SettingsRow>
            ) : null}
            <SettingsRow label="Change plan">
              <Button
                type="button"
                variant={showCompletePayment ? "outline" : "primary"}
                size="sm"
                disabled={checkoutLoading}
                onClick={() => setChangePlanOpen(true)}
              >
                Change plan
              </Button>
            </SettingsRow>
          </div>
        </SettingsCard>
      ) : null}

      <StorageUsageCard />

      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        plans={plans}
        subscription={subscription}
        currentPlanCode={permissions.planCode}
        subscriptionLoading={isLoading}
      />
    </SettingsSectionStack>
  );
}
