import { authFetch } from "../lib/authFetch";

export type BillingPeriod = "monthly" | "annual";

export type StartSubscriptionCheckoutInput = {
  planCode: "starter" | "investor" | "portfolio" | "portfolio_pro";
  billingPeriod: BillingPeriod;
};

export type SubscriptionCheckoutResponse = {
  checkoutUrl: string;
  reference: string;
  provider: "mock" | "paystack" | "payfast";
};

export async function startSubscriptionCheckout(
  input: StartSubscriptionCheckoutInput
): Promise<SubscriptionCheckoutResponse> {
  const data = (await authFetch("/api/subscription/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planCode: input.planCode,
      billingPeriod: input.billingPeriod
    })
  })) as Partial<SubscriptionCheckoutResponse>;

  if (!data.checkoutUrl || !data.reference || !data.provider) {
    throw new Error("No checkout URL returned.");
  }

  return {
    checkoutUrl: data.checkoutUrl,
    reference: data.reference,
    provider: data.provider
  };
}

export async function cancelSubscription(): Promise<{ message: string }> {
  return authFetch("/api/subscription/cancel", { method: "POST" }) as Promise<{ message: string }>;
}
