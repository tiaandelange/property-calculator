import type { VercelRequest } from "@vercel/node";
import type { PaymentBillingProvider } from "./provider.js";
import { publicSiteOrigin } from "./siteOrigin.js";
import { cancelSubscription as syncCancelSubscription } from "./billingSubscriptionSync.js";

function buildMockReference(userId: string): string {
  return `mock_${Date.now()}_${userId}`;
}

export const mockBillingProvider: PaymentBillingProvider = {
  name: "mock",

  async createCheckoutSession(input) {
    const reference = buildMockReference(input.userId);
    const origin = publicSiteOrigin();
    const params = new URLSearchParams({
      mock: "true",
      planCode: input.planCode,
      billingPeriod: input.billingPeriod,
      reference
    });
    const checkoutUrl = `${origin}/subscription/success?${params.toString()}`;
    return { checkoutUrl, reference };
  },

  async verifyWebhook(_req: VercelRequest) {
    throw new Error("Mock billing provider does not accept webhooks.");
  },

  async cancelSubscription(input) {
    await syncCancelSubscription({ userId: input.userId });
  }
};
