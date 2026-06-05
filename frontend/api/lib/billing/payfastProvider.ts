import type { VercelRequest } from "@vercel/node";
import type { PaymentBillingProvider } from "./provider";

const NOT_LIVE_MESSAGE = "PayFast billing is not enabled yet. Set BILLING_PROVIDER=mock for development.";

export const payfastBillingProvider: PaymentBillingProvider = {
  name: "payfast",

  async createCheckoutSession() {
    throw new Error(NOT_LIVE_MESSAGE);
  },

  async verifyWebhook(_req: VercelRequest) {
    throw new Error(NOT_LIVE_MESSAGE);
  },

  async cancelSubscription() {
    throw new Error(NOT_LIVE_MESSAGE);
  }
};
