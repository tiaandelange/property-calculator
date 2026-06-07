import { authFetch } from "../lib/authFetch";
import type { BillingPeriod, PlanCheckoutCode } from "./subscriptionVercel";

export type CompleteMockSubscriptionInput = {
  planCode: PlanCheckoutCode;
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

export async function verifySubscriptionCheckout(reference: string): Promise<{ message: string }> {
  return authFetch("/api/subscription/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference })
  }) as Promise<{ message: string }>;
}
