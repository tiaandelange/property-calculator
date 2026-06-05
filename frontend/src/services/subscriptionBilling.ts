import { authFetch } from "../lib/authFetch";
import type { BillingPeriod } from "./subscriptionVercel";

export type CompleteMockSubscriptionInput = {
  planCode: "investor" | "portfolio" | "portfolio_pro";
  reference?: string;
  billingPeriod?: BillingPeriod;
};

export async function completeMockSubscriptionCheckout(
  input: CompleteMockSubscriptionInput
): Promise<{ status: string; planCode: string }> {
  return authFetch("/api/subscription/mock-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  }) as Promise<{ status: string; planCode: string }>;
}
