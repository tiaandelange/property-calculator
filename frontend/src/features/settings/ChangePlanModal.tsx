import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppConfirmDialog, AppModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";
import {
  formatPlanPrice,
  planCardFeatureLines,
  planMarketingName,
  planPriceHeadline,
  planPriceSubline,
  type BillingPeriod
} from "../pricing/pricingPlanDisplay";
import { changeSubscriptionPlan } from "../../services/subscriptionBilling";
import {
  isPaidCheckoutPlanCode,
  redirectToPlanCheckout,
  type PlanCheckoutCode
} from "../../lib/billing/planCheckout";
import { useWorkspaceId } from "../queries";
import { queryKeys } from "../../lib/queryKeys";
import { trackEvent } from "../../lib/analytics/analytics";

type ChangePlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: SubscriptionPlanRecord[];
  subscription: UserSubscriptionRecord | null;
  currentPlanCode: string | null;
};

type ModalPhase = "idle" | "processing" | "success" | "error";

export function ChangePlanModal({
  open,
  onOpenChange,
  plans,
  subscription,
  currentPlanCode
}: ChangePlanModalProps) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmFreeOpen, setConfirmFreeOpen] = useState(false);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder || a.monthlyPrice - b.monthlyPrice),
    [plans]
  );

  const effectiveCurrentCode =
    subscription?.status === "pending_payment"
      ? subscription.planCode
      : (currentPlanCode ?? subscription?.planCode ?? "starter");

  const resetState = useCallback(() => {
    setSelectedCode(null);
    setPhase("idle");
    setMessage(null);
    setConfirmFreeOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === "processing") return;
    resetState();
    onOpenChange(false);
  }, [onOpenChange, phase, resetState]);

  const refreshSubscription = useCallback(async () => {
    if (workspaceId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscription(workspaceId) });
    }
  }, [queryClient, workspaceId]);

  const startPaidCheckout = useCallback(
    async (plan: SubscriptionPlanRecord) => {
      if (!isPaidCheckoutPlanCode(plan.code, plan.monthlyPrice)) {
        setPhase("error");
        setMessage("This plan cannot be purchased online. Contact us for Portfolio Pro.");
        return;
      }

      setPhase("processing");
      setMessage(null);
      trackEvent("change_plan_checkout_start", {
        plan_code: plan.code,
        billing_period: billingPeriod,
        source_page: "/settings"
      });

      try {
        await redirectToPlanCheckout(plan.code as PlanCheckoutCode, billingPeriod);
      } catch (e) {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Could not start checkout.");
      }
    },
    [billingPeriod]
  );

  const applyPlanSelection = useCallback(
    async (planCode: string) => {
      const plan = plans.find((p) => p.code === planCode);
      if (!plan) return;

      if (plan.code === effectiveCurrentCode && subscription?.status !== "pending_payment") {
        setMessage("You are already on this plan.");
        return;
      }

      setSelectedCode(planCode);
      setMessage(null);

      if (plan.monthlyPrice <= 0 || plan.code === "starter") {
        setConfirmFreeOpen(true);
        return;
      }

      await startPaidCheckout(plan);
    },
    [effectiveCurrentCode, plans, startPaidCheckout, subscription?.status]
  );

  const confirmDowngradeToFree = useCallback(async () => {
    setConfirmFreeOpen(false);
    setPhase("processing");
    setMessage(null);

    try {
      const result = await changeSubscriptionPlan({ planCode: "starter" });
      if (result.action === "downgraded") {
        await refreshSubscription();
        setPhase("success");
        setMessage("Your plan is now Free. Paid features are locked until you upgrade again.");
        trackEvent("change_plan_downgrade", { plan_code: "starter", source_page: "/settings" });
        return;
      }
      setPhase("error");
      setMessage("Unexpected response while changing plan.");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Could not change plan.");
    }
  }, [refreshSubscription]);

  const busy = phase === "processing";

  return (
    <>
      <AppModal
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
        title="Change plan"
        description="Choose a plan. Upgrades open secure Paystack checkout. Downgrading to Free cancels billing when connected."
        size="lg"
        closeOnOverlayClick={!busy}
        onClose={handleClose}
        footer={
          <div className="pg-app-modal-actions">
            <Button type="button" variant="soft" onClick={handleClose} disabled={busy}>
              Close
            </Button>
          </div>
        }
        footerBorder
      >
        <div className="pg-settings-subscription-plans">
          <div
            className="pg-settings-subscription-plans__billing-toggle"
            role="group"
            aria-label="Billing period"
          >
            <Button
              type="button"
              size="sm"
              variant={billingPeriod === "monthly" ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => setBillingPeriod("monthly")}
            >
              Monthly
            </Button>
            <Button
              type="button"
              size="sm"
              variant={billingPeriod === "annual" ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => setBillingPeriod("annual")}
            >
              Annual
            </Button>
          </div>

          {message ? (
            <div
              className={`pg-alert${phase === "error" ? " pg-alert-error" : ""}`}
              role="status"
              style={{ marginBottom: 12 }}
            >
              {message}
            </div>
          ) : null}

          {phase === "processing" ? (
            <div className="pg-settings-skeleton" style={{ minHeight: 120 }} aria-busy="true" />
          ) : (
            <div className="pg-settings-subscription-plans__grid">
              {sortedPlans.map((plan) => {
                const isCurrent =
                  plan.code === effectiveCurrentCode && subscription?.status !== "pending_payment";
                const isSelectedPending =
                  subscription?.status === "pending_payment" && subscription.planCode === plan.code;
                const priceHeadline = planPriceHeadline(plan, billingPeriod);
                const priceSubline = planPriceSubline(plan, billingPeriod);

                return (
                  <div
                    key={plan.code}
                    className={`pg-settings-subscription-plan${
                      isCurrent || isSelectedPending ? " pg-settings-subscription-plan--current" : ""
                    }`}
                  >
                    {isCurrent ? (
                      <span className="pg-settings-subscription-plan__tag">Current plan</span>
                    ) : isSelectedPending ? (
                      <span className="pg-settings-subscription-plan__tag">Selected</span>
                    ) : null}
                    <h4 className="pg-settings-subscription-plan__name">{planMarketingName(plan)}</h4>
                    <p className="pg-settings-subscription-plan__price">
                      {priceHeadline}
                      {priceSubline ? (
                        <span className="pg-settings-subscription-plan__price-sub">
                          {" "}
                          · {priceSubline}
                        </span>
                      ) : null}
                    </p>
                    <ul className="pg-settings-subscription-plan__features">
                      {planCardFeatureLines(plan).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrent ? "soft" : "primary"}
                      disabled={busy || isCurrent}
                      loading={busy && selectedCode === plan.code}
                      onClick={() => void applyPlanSelection(plan.code)}
                    >
                      {isCurrent
                        ? "Current plan"
                        : plan.monthlyPrice <= 0
                          ? "Switch to Free"
                          : `Choose ${planMarketingName(plan)}`}
                    </Button>
                    {plan.monthlyPrice > 0 && billingPeriod === "monthly" ? (
                      <p className="pg-settings-subscription-plan__footnote">
                        {formatPlanPrice(plan.monthlyPrice, plan.currency)} billed monthly
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppModal>

      <AppConfirmDialog
        open={confirmFreeOpen}
        onOpenChange={setConfirmFreeOpen}
        title="Switch to Free plan?"
        description="Your paid subscription will be cancelled when billing is connected. You will keep Starter limits immediately."
        confirmLabel="Switch to Free"
        destructive
        loading={busy}
        onConfirm={() => void confirmDowngradeToFree()}
        onCancel={() => setConfirmFreeOpen(false)}
      />
    </>
  );
}
