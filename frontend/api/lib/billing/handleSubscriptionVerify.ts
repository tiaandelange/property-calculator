import type { VercelRequest } from "@vercel/node";
import { createServiceRoleSupabase } from "../supabaseServiceRole.js";
import { BillingConfigError, resolveBillingProviderName } from "./billingEnv.js";
import {
  processProviderSubscriptionWebhookEvent,
  type WebhookProcessOutcome
} from "./billingSubscriptionSync.js";
import { CheckoutValidationError } from "./checkoutValidation.js";
import { verifyPaystackTransactionReference } from "./paystackProvider.js";
import type { BillingProviderName } from "./types.js";

export type SubscriptionVerifyResult = WebhookProcessOutcome;

function parseVerifyRequest(req: VercelRequest): { reference: string } {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  const reference = String(body.reference ?? "").trim();
  if (!reference) {
    throw new CheckoutValidationError("reference is required.");
  }

  return { reference };
}

async function assertCheckoutReferenceBelongsToUser(
  reference: string,
  userId: string,
  provider: BillingProviderName
): Promise<void> {
  const sb = createServiceRoleSupabase();
  if (!sb) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { data, error } = await sb
    .from("checkout_attempts")
    .select("user_id")
    .eq("provider", provider)
    .eq("provider_reference", reference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.user_id && String(data.user_id) !== userId) {
    throw new CheckoutValidationError("Payment reference does not belong to this account.", 403);
  }
}

export async function handleSubscriptionVerify(
  req: VercelRequest,
  userId: string
): Promise<SubscriptionVerifyResult> {
  const { reference } = parseVerifyRequest(req);
  const providerName = resolveBillingProviderName();

  if (providerName !== "paystack") {
    throw new BillingConfigError("Checkout verification is only supported for Paystack.");
  }

  await assertCheckoutReferenceBelongsToUser(reference, userId, "paystack");

  const event = await verifyPaystackTransactionReference(reference);
  if (event.userId && event.userId !== userId) {
    throw new CheckoutValidationError("Payment reference does not belong to this account.", 403);
  }

  return processProviderSubscriptionWebhookEvent({
    ...event,
    userId: event.userId ?? userId
  });
}
