import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ButtonLink } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { PageBrandMark } from "../components/brand/PageBrandMark";
import { useSubscriptionQuery } from "../lib/subscription/useSubscriptionQuery";
import { useWorkspaceId } from "../features/queries";
import { queryKeys } from "../lib/queryKeys";
import {
  completeMockSubscriptionCheckout,
  verifySubscriptionCheckout
} from "../services/subscriptionBilling";
import { planDisplayName } from "../features/pricing/pricingPlanDisplay";
import { settingsSubscriptionPath } from "../features/signup/signupBillingFlow";
import type { PlanCheckoutCode } from "../lib/billing/planCheckout";
import {
  isDevMockCheckoutAllowed,
  paystackCheckoutReference,
  resolveSubscriptionSuccessViewState,
  subscriptionSuccessHeadline,
  subscriptionSuccessMessage
} from "../features/subscription/subscriptionSuccessState";
import { trackEvent } from "../lib/analytics/analytics";

const DASHBOARD_PATH = "/owned-properties/dashboard";
const PAYSTACK_VERIFY_POLL_MS = 2000;
const PAYSTACK_VERIFY_POLL_MAX_MS = 30000;

function isPaidPlanCode(code: string | null): code is PlanCheckoutCode {
  return code === "investor" || code === "portfolio" || code === "portfolio_pro";
}

export function SubscriptionResultPage({ mode }: { mode: "success" | "cancel" }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { data, refetch, isLoading, isFetching, isError, error } = useSubscriptionQuery();
  const [mockStatus, setMockStatus] = useState<"idle" | "loading" | "done" | "error" | "skipped">(
    "idle"
  );
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [mockError, setMockError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const verifyStartedRef = useRef(false);
  const subscriptionSuccessTrackedRef = useRef(false);

  const mock = searchParams.get("mock") === "true";
  const planCodeParam = searchParams.get("planCode");
  const paystackReference = paystackCheckoutReference(searchParams);
  const reference = searchParams.get("reference") ?? undefined;
  const billingPeriod =
    searchParams.get("billingPeriod") === "annual" ? "annual" : "monthly";

  const subscription = data?.subscription ?? null;
  const planName =
    (planCodeParam && planDisplayName(planCodeParam, data?.plans ?? [])) ??
    (subscription?.planCode
      ? planDisplayName(subscription.planCode, data?.plans ?? [])
      : null);

  const awaitingPaystackVerify =
    mode === "success" && Boolean(paystackReference) && verifyStatus !== "done" && verifyStatus !== "error";
  const initialLoading =
    isLoading ||
    (isFetching && subscription == null && mockStatus !== "done") ||
    awaitingPaystackVerify;
  const viewState =
    mode === "cancel"
      ? "failed"
      : resolveSubscriptionSuccessViewState(subscription, { loading: initialLoading });

  const refreshSubscription = useCallback(async () => {
    setRefreshing(true);
    try {
      if (workspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.subscription(workspaceId) });
      }
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch, workspaceId]);

  useEffect(() => {
    if (mode !== "success") return;
    void refreshSubscription();
  }, [mode, refreshSubscription]);

  useEffect(() => {
    if (mode !== "success" || !paystackReference || verifyStartedRef.current) return;
    verifyStartedRef.current = true;
    setVerifyStatus("loading");

    void verifySubscriptionCheckout(paystackReference)
      .then(async () => {
        await refreshSubscription();
        setVerifyStatus("done");
      })
      .catch((e: unknown) => {
        setVerifyError(e instanceof Error ? e.message : "Could not verify payment.");
        setVerifyStatus("error");
      });
  }, [mode, paystackReference, refreshSubscription]);

  useEffect(() => {
    if (mode !== "success" || viewState !== "pending_payment") return;

    const interval = window.setInterval(() => {
      void refreshSubscription();
    }, PAYSTACK_VERIFY_POLL_MS);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, PAYSTACK_VERIFY_POLL_MAX_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [mode, viewState, refreshSubscription]);

  useEffect(() => {
    if (mode !== "success" || viewState !== "active" || initialLoading) return;
    if (subscriptionSuccessTrackedRef.current) return;
    subscriptionSuccessTrackedRef.current = true;
    const planCode = subscription?.planCode ?? planCodeParam ?? undefined;
    trackEvent("subscription_success", {
      ...(planCode ? { plan_code: planCode } : {}),
      billing_period: billingPeriod,
      source_page: "/subscription/success"
    });
  }, [mode, viewState, initialLoading, subscription?.planCode, planCodeParam, billingPeriod]);

  useEffect(() => {
    if (mode !== "success" || viewState !== "active") return;
    const timeout = window.setTimeout(() => {
      navigate(DASHBOARD_PATH, { replace: true });
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [mode, viewState, navigate]);

  useEffect(() => {
    if (mode !== "success" || !mock || mockStatus !== "idle") return;

    if (!isDevMockCheckoutAllowed()) {
      setMockStatus("skipped");
      return;
    }

    if (!isPaidPlanCode(planCodeParam)) {
      setMockStatus("skipped");
      return;
    }

    setMockStatus("loading");
    void completeMockSubscriptionCheckout({
      planCode: planCodeParam,
      reference,
      billingPeriod
    })
      .then(async () => {
        await refreshSubscription();
        setMockStatus("done");
      })
      .catch((e: unknown) => {
        setMockError(e instanceof Error ? e.message : "Could not confirm mock payment.");
        setMockStatus("error");
      });
  }, [mode, mock, mockStatus, planCodeParam, reference, billingPeriod, refreshSubscription]);

  const checkoutSettingsPath = settingsSubscriptionPath({
    checkout: true,
    planCode: subscription?.planCode ?? planCodeParam ?? undefined
  });

  const headline =
    mode === "cancel"
      ? "Checkout cancelled"
      : viewState === "active"
        ? "Payment successful"
        : subscriptionSuccessHeadline(viewState, planName);

  const message =
    mode === "cancel"
      ? "No worries — you can complete payment any time from subscription settings."
      : viewState === "active"
        ? planName
          ? `Your ${planName} plan is active. Opening your dashboard…`
          : "Your subscription is active. Opening your dashboard…"
        : subscriptionSuccessMessage(viewState, planName);

  const showMockDevNotice =
    mode === "success" && mock && isDevMockCheckoutAllowed() && mockStatus !== "idle";

  return (
    <Section>
      <Helmet>
        <title>
          {mode === "success" ? "Subscription Success" : "Subscription Cancelled"} | Proplytic
        </title>
        <meta name="description" content="Subscription status." />
      </Helmet>
      <Container>
        <div className="pg-subscription-result" style={{ maxWidth: 820, margin: "0 auto" }}>
          <PageBrandMark />
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              {headline}
            </h1>
            <p className="pg-lead">{message}</p>

            {mode === "success" && viewState === "loading" ? (
              <div className="pg-subscription-result__loading" role="status" aria-live="polite">
                <span className="pg-subscription-result__spinner" aria-hidden />
                {verifyStatus === "loading"
                  ? "Confirming payment with Paystack…"
                  : "Loading subscription status…"}
              </div>
            ) : null}

            {isError ? (
              <div className="pg-alert pg-alert-error" role="alert" style={{ marginBottom: 16 }}>
                {error instanceof Error ? error.message : "Could not load subscription status."}
              </div>
            ) : null}

            {mode === "success" && verifyStatus === "error" && verifyError ? (
              <div className="pg-alert pg-alert-error" role="alert" style={{ marginBottom: 16 }}>
                {verifyError}
              </div>
            ) : null}

            {mode === "success" && viewState === "pending_payment" ? (
              <div className="pg-alert" role="status" style={{ marginBottom: 16 }}>
                Payment confirmation can take a few seconds. This page will refresh automatically.
              </div>
            ) : null}

            {showMockDevNotice ? (
              <div className="pg-alert" role="status" style={{ marginBottom: 16 }}>
                {mockStatus === "loading"
                  ? "Running development mock activation…"
                  : mockStatus === "done"
                    ? "Development mock checkout completed on the server."
                    : mockStatus === "error"
                      ? mockError ?? "Mock activation failed in development."
                      : null}
              </div>
            ) : null}

            <div className="pg-subscription-result__actions">
              {mode === "success" && viewState === "pending_payment" ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={refreshing || isFetching}
                  disabled={refreshing || isFetching}
                  onClick={() => void refreshSubscription()}
                >
                  Refresh status
                </Button>
              ) : null}

              {mode === "success" && viewState === "failed" ? (
                <ButtonLink href={checkoutSettingsPath} variant="primary" size="sm">
                  Try payment again
                </ButtonLink>
              ) : null}

              {mode === "cancel" ? (
                <ButtonLink href={checkoutSettingsPath} variant="primary" size="sm">
                  Complete payment
                </ButtonLink>
              ) : null}

              {mode === "success" && viewState !== "active" ? (
                <ButtonLink href={DASHBOARD_PATH} variant="secondary" size="sm">
                  Go to dashboard
                </ButtonLink>
              ) : null}

              <ButtonLink href="/settings?section=subscription" variant="ghost" size="sm">
                Manage subscription
              </ButtonLink>
              <ButtonLink href="/pricing" variant="ghost" size="sm">
                View plans
              </ButtonLink>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
