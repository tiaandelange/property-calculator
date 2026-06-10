import type { VercelRequest } from "@vercel/node";
import {
  BillingConfigError,
  getBillingProvider,
  resolveWebhookBillingProvider
} from "./provider.js";
import {
  processProviderSubscriptionWebhookEvent,
  WebhookProcessingError,
  type WebhookProcessOutcome
} from "./billingSubscriptionSync.js";

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export { WebhookProcessingError };

export type SubscriptionWebhookResult = {
  received: true;
  provider: string;
  type: string;
  alreadyProcessed?: boolean;
  skipped?: boolean;
  skipReason?: string;
};

function isVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /signature/i.test(error.message) ||
    /missing x-paystack-signature/i.test(error.message) ||
    /invalid paystack webhook json/i.test(error.message) ||
    /payload is missing event/i.test(error.message)
  );
}

/**
 * Provider-agnostic subscription webhook pipeline:
 * verify → idempotency check → webhook_events → user_subscriptions → processed_at
 */
export async function handleProviderSubscriptionWebhook(
  req: VercelRequest
): Promise<SubscriptionWebhookResult> {
  const provider = resolveWebhookBillingProvider(req);
  const event = await provider.verifyWebhook(req);
  const outcome = await processProviderSubscriptionWebhookEvent(event);

  return {
    received: true,
    provider: event.provider,
    type: event.eventType,
    ...(outcome.status === "already_processed" ? { alreadyProcessed: true } : {}),
    ...(outcome.status === "skipped"
      ? { skipped: true, skipReason: outcome.reason }
      : {})
  };
}

/** Uses configured checkout provider when no webhook signature headers are present (tests). */
export async function handleConfiguredProviderSubscriptionWebhook(
  req: VercelRequest
): Promise<SubscriptionWebhookResult> {
  const provider = getBillingProvider();
  if (provider.name === "mock") {
    throw new BillingConfigError("Mock billing provider does not accept webhooks.");
  }
  const event = await provider.verifyWebhook(req);
  const outcome = await processProviderSubscriptionWebhookEvent(event);
  return {
    received: true,
    provider: event.provider,
    type: event.eventType,
    ...(outcome.status === "already_processed" ? { alreadyProcessed: true } : {}),
    ...(outcome.status === "skipped"
      ? { skipped: true, skipReason: outcome.reason }
      : {})
  };
}

export function mapWebhookError(error: unknown): { status: number; message: string } {
  if (error instanceof BillingConfigError) {
    return { status: 503, message: error.message };
  }
  if (error instanceof WebhookVerificationError || isVerificationError(error)) {
    return {
      status: 400,
      message: error instanceof Error ? error.message : "Invalid webhook signature."
    };
  }
  if (error instanceof WebhookProcessingError) {
    return { status: 500, message: error.message };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Webhook processing failed."
  };
}

export { type WebhookProcessOutcome };
