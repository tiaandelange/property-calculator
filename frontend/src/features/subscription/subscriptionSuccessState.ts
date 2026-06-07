import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";

export type SubscriptionSuccessViewState =
  | "loading"
  | "active"
  | "pending_payment"
  | "failed"
  | "unknown";

export function resolveSubscriptionSuccessViewState(
  subscription: UserSubscriptionRecord | null | undefined,
  opts: { loading: boolean }
): SubscriptionSuccessViewState {
  if (opts.loading) return "loading";

  if (!subscription) return "unknown";

  const status = subscription.status;
  if (status === "active" || status === "active_manual" || status === "trialing") {
    return "active";
  }
  if (status === "pending_payment") {
    return "pending_payment";
  }
  if (status === "cancelled" || status === "expired" || status === "past_due") {
    return "failed";
  }

  return "unknown";
}

export function subscriptionSuccessHeadline(
  viewState: SubscriptionSuccessViewState,
  planName: string | null
): string {
  switch (viewState) {
    case "loading":
      return "Checking subscription status…";
    case "active":
      return "Subscription active";
    case "pending_payment":
      return "Verifying payment";
    case "failed":
      return "Payment not completed";
    case "unknown":
    default:
      return "Subscription status";
  }
}

export function subscriptionSuccessMessage(
  viewState: SubscriptionSuccessViewState,
  planName: string | null
): string {
  const planLabel = planName ? `Your ${planName} plan` : "Your subscription";

  switch (viewState) {
    case "loading":
      return "Please wait while we confirm your subscription status.";
    case "active":
      return planLabel + " is active. You can use your plan features now.";
    case "pending_payment":
      return "Payment received or being verified. This may take a moment.";
    case "failed":
      return "We could not confirm an active subscription. You can try checkout again from subscription settings.";
    case "unknown":
    default:
      return "We could not load your subscription status. Check subscription settings or try again shortly.";
  }
}

/** Mock checkout completion is dev-only; production uses Paystack verify + webhooks. */
export function isDevMockCheckoutAllowed(): boolean {
  return import.meta.env.DEV;
}

/** Paystack appends `reference` and `trxref` on redirect back from checkout. */
export function paystackCheckoutReference(params: URLSearchParams): string | null {
  if (params.get("mock") === "true") return null;
  return params.get("reference") ?? params.get("trxref");
}
