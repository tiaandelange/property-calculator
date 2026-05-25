import { authFetch } from "../lib/authFetch";

export async function startSubscriptionCheckout(): Promise<{ checkoutUrl: string }> {
  const data = (await authFetch("/api/subscription/checkout", { method: "POST" })) as {
    checkoutUrl?: string;
  };
  if (!data.checkoutUrl) throw new Error("No checkout URL returned.");
  return { checkoutUrl: data.checkoutUrl };
}

export async function cancelSubscription(): Promise<{ message: string }> {
  return authFetch("/api/subscription/cancel", { method: "POST" }) as Promise<{ message: string }>;
}
