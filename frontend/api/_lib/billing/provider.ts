import type { VercelRequest } from "@vercel/node";
import type { BillingProviderName } from "./types.js";
import { BillingConfigError, resolveBillingProviderName } from "./billingEnv.js";
import { mockBillingProvider } from "./mockProvider.js";
import { payfastBillingProvider } from "./payfastProvider.js";
import { paystackBillingProvider } from "./paystackProvider.js";

export { BillingConfigError, resolveBillingProviderName } from "./billingEnv.js";

export interface PaymentBillingProvider {
  name: BillingProviderName;

  createCheckoutSession(input: {
    userId: string;
    email: string;
    planCode: string;
    billingPeriod: "monthly" | "annual";
  }): Promise<{
    checkoutUrl: string;
    reference: string;
  }>;

  verifyWebhook(req: VercelRequest): Promise<import("./types.js").ProviderWebhookEvent>;

  cancelSubscription(input: {
    userId: string;
    subscriptionId?: string | null;
  }): Promise<void>;
}

const PROVIDERS: Record<BillingProviderName, PaymentBillingProvider> = {
  mock: mockBillingProvider,
  paystack: paystackBillingProvider,
  payfast: payfastBillingProvider
};

export function getBillingProvider(): PaymentBillingProvider {
  return PROVIDERS[resolveBillingProviderName()];
}

function headerValue(req: VercelRequest, name: string): string | null {
  const header = req.headers[name];
  if (typeof header !== "string" || !header.trim()) return null;
  return header.trim();
}

/** Pick the billing provider for an incoming webhook (header-first, then BILLING_PROVIDER). */
export function resolveWebhookBillingProvider(req: VercelRequest): PaymentBillingProvider {
  if (headerValue(req, "x-paystack-signature")) {
    return paystackBillingProvider;
  }

  const configured = resolveBillingProviderName();
  if (configured === "mock") {
    throw new BillingConfigError("Mock billing provider does not accept webhooks.");
  }

  return PROVIDERS[configured];
}

export function hasLegacyStripeWebhookSignature(req: VercelRequest): boolean {
  return Boolean(headerValue(req, "stripe-signature")) && !headerValue(req, "x-paystack-signature");
}

