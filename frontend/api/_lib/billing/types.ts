export type BillingProviderName = "mock" | "paystack" | "payfast";

export type BillingPeriod = "monthly" | "annual";

export type CheckoutRequest = {
  userId: string;
  email: string;
  planCode: string;
  billingPeriod: BillingPeriod;
};

export type CheckoutResult = {
  checkoutUrl: string;
  reference: string;
  provider: BillingProviderName;
};

export type ProviderWebhookEvent = {
  provider: BillingProviderName;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  userId?: string;
  planCode?: string;
  subscriptionId?: string;
  customerId?: string;
  status?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
};
