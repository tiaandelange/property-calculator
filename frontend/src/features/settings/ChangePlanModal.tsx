import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppConfirmDialog, AppModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";
import { planMarketingName } from "../pricing/pricingPlanDisplay";
import { changeSubscriptionPlan } from "../../services/subscriptionBilling";
import {
  isPaidCheckoutPlanCode,
  redirectToPlanCheckout,
  type PlanCheckoutCode
} from "../../lib/billing/planCheckout";
import { useWorkspaceId } from "../queries";
import { queryKeys } from "../../lib/queryKeys";
import { trackEvent } from "../../lib/analytics/analytics";
import { ApiRequestError } from "../../lib/queryErrors";
import {
  filterPlansForChangeModal,
  planModalCtaLabel,
  planModalFeatureBullets,
  planModalPriceLine,
  planModalShortDescription,
  planModalTrialNote,
  resolveChangeModalCurrentPlanCode,
  resolvePendingCheckoutPlanCode
} from "./planModalDisplay";

type ChangePlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: SubscriptionPlanRecord[];
  subscription: UserSubscriptionRecord | null;
  currentPlanCode: string | null;
  subscriptionLoading?: boolean;
};

type ModalPhase = "idle" | "processing" | "success" | "error";

function formatBillingActionError(error: unknown, action: "checkout" | "downgrade"): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) {
      return action === "checkout"
        ? "Could not start checkout. The billing endpoint was not found. Please refresh and try again."
        : "Could not change plan. The billing endpoint was not found. Please refresh and try again.";
    }
    if (error.message && !error.message.startsWith("Request failed (")) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return action === "checkout" ? "Could not start checkout." : "Could not change plan.";
}

export function ChangePlanModal({
  open,
  onOpenChange,
  plans,
  subscription,
  currentPlanCode,
  subscriptionLoading = false
}: ChangePlanModalProps) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmFreeOpen, setConfirmFreeOpen] = useState(false);

  const modalPlans = useMemo(() => filterPlansForChangeModal(plans), [plans]);

  const currentPlanCodeResolved = useMemo(
    () => resolveChangeModalCurrentPlanCode(subscription, currentPlanCode),
    [subscription, currentPlanCode]
  );

  const pendingCheckoutPlanCode = useMemo(
    () => resolvePendingCheckoutPlanCode(subscription),
    [subscription]
  );

  const hasPaidPlan =
    subscription?.status === "active" &&
    subscription.planCode !== "starter" &&
    Boolean(subscription.paymentProvider);

  const currentPlanLabel = useMemo(() => {
    const plan = modalPlans.find((p) => p.code === currentPlanCodeResolved);
    return plan ? planMarketingName(plan) : "Free";
  }, [modalPlans, currentPlanCodeResolved]);

  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setMessage(null);
    setSelectedCode(null);
    setConfirmFreeOpen(false);
  }, [open]);

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

  const startPaidCheckout = useCallback(async (plan: SubscriptionPlanRecord) => {
    if (!isPaidCheckoutPlanCode(plan.code, plan.monthlyPrice)) {
      setPhase("error");
      setMessage("This plan is not available for online checkout.");
      return;
    }

    setPhase("processing");
    setMessage(null);
    setSelectedCode(plan.code);
    trackEvent("change_plan_checkout_start", {
      plan_code: plan.code,
      billing_period: "monthly",
      source_page: "/settings"
    });

    try {
      await redirectToPlanCheckout(plan.code as PlanCheckoutCode, "monthly");
    } catch (e) {
      setPhase("error");
      setMessage(formatBillingActionError(e, "checkout"));
      setSelectedCode(null);
    }
  }, []);

  const applyPlanSelection = useCallback(
    async (planCode: string) => {
      const plan = modalPlans.find((p) => p.code === planCode);
      if (!plan) return;

      const isCurrent =
        plan.code === currentPlanCodeResolved && subscription?.status !== "pending_payment";

      if (isCurrent) {
        return;
      }

      setMessage(null);

      if (plan.code === "starter") {
        if (!hasPaidPlan && currentPlanCodeResolved === "starter") {
          return;
        }
        setConfirmFreeOpen(true);
        return;
      }

      await startPaidCheckout(plan);
    },
    [currentPlanCodeResolved, hasPaidPlan, modalPlans, startPaidCheckout, subscription?.status]
  );

  const confirmDowngradeToFree = useCallback(async () => {
    setConfirmFreeOpen(false);
    setPhase("processing");
    setMessage(null);
    setSelectedCode("starter");

    try {
      const result = await changeSubscriptionPlan({ planCode: "starter" });
      if (result.action === "downgraded") {
        await refreshSubscription();
        setPhase("success");
        setMessage("Your plan is now Free.");
        trackEvent("change_plan_downgrade", { plan_code: "starter", source_page: "/settings" });
        return;
      }
      setPhase("error");
      setMessage("Unexpected response while changing plan.");
    } catch (e) {
      setPhase("error");
      setMessage(formatBillingActionError(e, "downgrade"));
    } finally {
      setSelectedCode(null);
    }
  }, [refreshSubscription]);

  const busy = phase === "processing";

  return (
    <>
      <AppModal
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
        title="Change plan"
        description="Choose the plan that fits your portfolio. Upgrades open secure Paystack checkout."
        size="xl"
        className="pg-change-plan-modal"
        closeOnOverlayClick={!busy}
        onClose={handleClose}
        mobileSheet
      >
        <div className="pg-change-plan-modal__inner">
          <div className="pg-change-plan-modal__summary" role="status">
            <span className="pg-change-plan-modal__summary-label">Current plan</span>
            <span className="pg-change-plan-modal__summary-value">{currentPlanLabel}</span>
            {pendingCheckoutPlanCode ? (
              <span className="pg-change-plan-modal__summary-pending">
                Payment pending for{" "}
                {(() => {
                  const pendingPlan = modalPlans.find((p) => p.code === pendingCheckoutPlanCode);
                  return pendingPlan ? planMarketingName(pendingPlan) : pendingCheckoutPlanCode;
                })()}
              </span>
            ) : null}
          </div>

          {message ? (
            <div
              className={`pg-change-plan-modal__alert pg-alert${
                phase === "error" ? " pg-alert-error" : ""
              }`}
              role="status"
            >
              {message}
            </div>
          ) : null}

          {subscriptionLoading ? (
            <div className="pg-change-plan-modal__loading" aria-busy="true">
              <span className="pg-subscription-result__spinner" aria-hidden />
              <span>Loading your subscription…</span>
            </div>
          ) : busy ? (
            <div className="pg-change-plan-modal__loading" aria-busy="true">
              <span className="pg-subscription-result__spinner" aria-hidden />
              <span>Opening secure checkout…</span>
            </div>
          ) : (
            <div className="pg-change-plan-grid">
              {modalPlans.map((plan) => {
                const isCurrent =
                  plan.code === currentPlanCodeResolved &&
                  subscription?.status !== "pending_payment";
                const isPendingCheckout = pendingCheckoutPlanCode === plan.code;
                const trialNote = planModalTrialNote(plan);
                const ctaLabel = planModalCtaLabel(plan, {
                  isCurrent,
                  isPendingCheckout,
                  hasPaidPlan
                });
                const ctaDisabled =
                  busy || isCurrent || (plan.code === "starter" && !hasPaidPlan && isCurrent);

                return (
                  <article
                    key={plan.code}
                    className={`pg-change-plan-card${
                      isCurrent ? " pg-change-plan-card--current" : ""
                    }${isPendingCheckout ? " pg-change-plan-card--pending" : ""}`}
                  >
                    {isCurrent ? (
                      <span className="pg-change-plan-card__badge">Current plan</span>
                    ) : isPendingCheckout ? (
                      <span className="pg-change-plan-card__badge pg-change-plan-card__badge--pending">
                        Selected
                      </span>
                    ) : null}

                    <div className="pg-change-plan-card__body">
                      <h3 className="pg-change-plan-card__name">{planMarketingName(plan)}</h3>
                      <p className="pg-change-plan-card__price">{planModalPriceLine(plan)}</p>
                      {trialNote ? (
                        <p className="pg-change-plan-card__trial">{trialNote}</p>
                      ) : null}
                      <p className="pg-change-plan-card__desc">{planModalShortDescription(plan)}</p>
                      <ul className="pg-change-plan-card__features">
                        {planModalFeatureBullets(plan).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pg-change-plan-card__cta">
                      <Button
                        type="button"
                        size="sm"
                        variant={isCurrent ? "soft" : "primary"}
                        disabled={ctaDisabled}
                        loading={busy && selectedCode === plan.code}
                        onClick={() => void applyPlanSelection(plan.code)}
                      >
                        {ctaLabel}
                      </Button>
                    </div>
                  </article>
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
        description="Your paid subscription will be cancelled when billing is connected. You will keep Free plan limits immediately."
        confirmLabel="Downgrade to Free"
        destructive
        loading={busy}
        onConfirm={() => void confirmDowngradeToFree()}
        onCancel={() => setConfirmFreeOpen(false)}
      />
    </>
  );
}
