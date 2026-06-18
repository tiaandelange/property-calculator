import { createServiceRoleSupabase } from "../supabaseServiceRole.js";
import { CheckoutValidationError } from "./checkoutValidation.js";
import type { BillingProviderName, ProviderWebhookEvent } from "./types.js";

export class WebhookProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookProcessingError";
  }
}

function requireServiceRole() {
  const sb = createServiceRoleSupabase();
  if (!sb) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return sb;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export type ActivateSubscriptionInput = {
  userId: string;
  planCode: string;
  provider: BillingProviderName;
  customerId?: string | null;
  subscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
};

export type SubscriptionLifecycleInput = {
  userId: string;
};

export type RecordCheckoutAttemptInput = {
  userId: string;
  planCode: string;
  billingPeriod: "monthly" | "annual";
  provider: BillingProviderName;
  providerReference: string;
  checkoutUrl: string;
  status?: "created" | "redirected";
};

export type WebhookProcessOutcome =
  | { status: "already_processed" }
  | { status: "processed" }
  | { status: "skipped"; reason: string };

export async function hasWebhookEventBeenProcessed(
  provider: BillingProviderName,
  providerEventId: string
): Promise<boolean> {
  const sb = requireServiceRole();
  const { data, error } = await sb
    .from("webhook_events")
    .select("id, processed_at")
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.processed_at);
}

export async function upsertWebhookEvent(
  event: ProviderWebhookEvent,
  opts?: { processed?: boolean; processingError?: string | null }
): Promise<void> {
  const sb = requireServiceRole();
  const now = new Date().toISOString();
  const row = {
    provider: event.provider,
    provider_event_id: event.providerEventId,
    event_type: event.eventType,
    payload: event.payload,
    processed_at: opts?.processed ? now : null,
    processing_error: opts?.processingError ?? null
  };

  const { error } = await sb.from("webhook_events").upsert(row, {
    onConflict: "provider,provider_event_id"
  });

  if (error) throw new Error(error.message);
}

export async function markWebhookEventProcessed(
  provider: BillingProviderName,
  providerEventId: string,
  processingError?: string | null
): Promise<void> {
  const sb = requireServiceRole();
  const { error } = await sb
    .from("webhook_events")
    .update({
      processed_at: processingError ? null : new Date().toISOString(),
      processing_error: processingError ?? null
    })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);

  if (error) throw new Error(error.message);
}

function calendarMonthIsoBounds(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

const PLAN_TRIAL_DAYS: Record<string, number> = {
  starter: 0,
  investor: 0,
  portfolio: 14,
  portfolio_pro: 0
};

export type SubscriptionRowFields = {
  plan_code: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

/** Build initial subscription row fields for a plan (signup / checkout prep). */
export function buildSubscriptionFieldsForPlan(
  planCode: string,
  monthlyPrice: number
): SubscriptionRowFields {
  const now = new Date();
  const trialDays = PLAN_TRIAL_DAYS[planCode] ?? 0;

  if (monthlyPrice <= 0 || planCode === "starter") {
    const period = calendarMonthIsoBounds(now);
    return {
      plan_code: "starter",
      status: "active",
      trial_start: null,
      trial_end: null,
      current_period_start: period.start,
      current_period_end: period.end
    };
  }

  if (trialDays > 0) {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    return {
      plan_code: planCode,
      status: "trialing",
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: null,
      current_period_end: null
    };
  }

  return {
    plan_code: planCode,
    status: "pending_payment",
    trial_start: null,
    trial_end: null,
    current_period_start: null,
    current_period_end: null
  };
}

/**
 * Ensures a user_subscriptions row exists. Idempotent — does not overwrite an existing row.
 */
export async function ensureUserSubscriptionRow(
  userId: string,
  planCode = "starter",
  monthlyPrice = 0
): Promise<{ created: boolean }> {
  const sb = requireServiceRole();
  const { data: existing, error: existingErr } = await sb
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);
  if (existing) return { created: false };

  const fields = buildSubscriptionFieldsForPlan(planCode, monthlyPrice);
  const { error: insertErr } = await sb.from("user_subscriptions").insert({
    user_id: userId,
    ...fields,
    payment_provider: null,
    payment_customer_id: null,
    payment_subscription_id: null
  });

  if (insertErr) throw new Error(insertErr.message);
  return { created: true };
}

/**
 * Updates plan selection before hosted checkout (pending_payment / trialing).
 * Creates the row when missing.
 */
export async function prepareUserSubscriptionForCheckout(
  userId: string,
  planCode: string,
  monthlyPrice: number
): Promise<void> {
  const sb = requireServiceRole();
  const fields = buildSubscriptionFieldsForPlan(planCode, monthlyPrice);
  const now = new Date().toISOString();

  const { data: existing, error: existingErr } = await sb
    .from("user_subscriptions")
    .select("id, plan_code, status, payment_provider")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  if (
    existing &&
    existing.status === "active" &&
    existing.plan_code === planCode &&
    existing.payment_provider
  ) {
    throw new CheckoutValidationError(`You are already subscribed to ${planCode}.`, 409);
  }

  if (existing) {
    const { error } = await sb
      .from("user_subscriptions")
      .update({ ...fields, updated_at: now })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error: insertErr } = await sb.from("user_subscriptions").insert({
    user_id: userId,
    ...fields,
    payment_provider: null,
    payment_customer_id: null,
    payment_subscription_id: null
  });
  if (insertErr) throw new Error(insertErr.message);
}

/** Downgrade to the free Starter plan and clear payment provider linkage. */
export async function downgradeToStarterPlan(userId: string): Promise<void> {
  const sb = requireServiceRole();
  const fields = buildSubscriptionFieldsForPlan("starter", 0);
  const now = new Date().toISOString();

  const { data: existing, error: existingErr } = await sb
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  const payload = {
    ...fields,
    payment_provider: null,
    payment_customer_id: null,
    payment_subscription_id: null,
    updated_at: now
  };

  if (existing) {
    const { error } = await sb.from("user_subscriptions").update(payload).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error: insertErr } = await sb.from("user_subscriptions").insert({
    user_id: userId,
    ...payload
  });
  if (insertErr) throw new Error(insertErr.message);
}

export async function activateSubscription(input: ActivateSubscriptionInput): Promise<void> {
  const sb = requireServiceRole();
  const payload = {
    plan_code: input.planCode,
    status: "active",
    payment_provider: input.provider,
    payment_customer_id: input.customerId ?? null,
    payment_subscription_id: input.subscriptionId ?? null,
    current_period_start: input.currentPeriodStart ?? null,
    current_period_end: input.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: existingErr } = await sb
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  if (existing) {
    const { error } = await sb.from("user_subscriptions").update(payload).eq("user_id", input.userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error: insertErr } = await sb.from("user_subscriptions").insert({
    user_id: input.userId,
    trial_start: null,
    trial_end: null,
    ...payload
  });
  if (insertErr) throw new Error(insertErr.message);
}

export async function cancelSubscription(input: SubscriptionLifecycleInput): Promise<void> {
  const sb = requireServiceRole();
  const { error } = await sb
    .from("user_subscriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", input.userId);

  if (error) throw new Error(error.message);
}

export async function markPastDue(input: SubscriptionLifecycleInput): Promise<void> {
  const sb = requireServiceRole();
  const { error } = await sb
    .from("user_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", input.userId);

  if (error) throw new Error(error.message);
}

export async function markExpired(input: SubscriptionLifecycleInput): Promise<void> {
  const sb = requireServiceRole();
  const { error } = await sb
    .from("user_subscriptions")
    .update({
      status: "expired",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", input.userId);

  if (error) throw new Error(error.message);
}

function extractTransactionReference(event: ProviderWebhookEvent): string | undefined {
  const payloadData = asRecord(event.payload.data);
  return readString(payloadData?.reference);
}

/** Resolve Proplytic user id without guessing ownership. */
export async function resolveWebhookUserId(
  event: ProviderWebhookEvent
): Promise<string | null> {
  if (event.userId) return event.userId;

  const sb = requireServiceRole();

  if (event.subscriptionId) {
    const { data, error } = await sb
      .from("user_subscriptions")
      .select("user_id")
      .eq("payment_subscription_id", event.subscriptionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.user_id) return String(data.user_id);
  }

  if (event.customerId) {
    const { data, error } = await sb
      .from("user_subscriptions")
      .select("user_id")
      .eq("payment_customer_id", event.customerId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.user_id) return String(data.user_id);
  }

  const reference = extractTransactionReference(event);
  if (reference) {
    const { data, error } = await sb
      .from("checkout_attempts")
      .select("user_id")
      .eq("provider", event.provider)
      .eq("provider_reference", reference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.user_id) return String(data.user_id);
  }

  return null;
}

function isActivationEvent(event: ProviderWebhookEvent): boolean {
  const type = event.eventType.toLowerCase();
  const status = (event.status || "").toLowerCase();

  if (type === "subscription.create") return true;
  if (type === "charge.success") return true;
  if (type === "invoice.update" && (status === "active" || status === "success" || status === "paid")) {
    return true;
  }
  if (type.includes("activate") || type.includes("complete")) return true;
  if (status === "active" || status === "success" || status === "completed" || status === "paid") {
    return true;
  }
  return false;
}

function isCancellationEvent(event: ProviderWebhookEvent): boolean {
  const type = event.eventType.toLowerCase();
  const status = (event.status || "").toLowerCase();
  if (type === "subscription.disable") return true;
  if (type.includes("cancel") || type.includes("disable")) return true;
  if (status === "cancelled" || status === "canceled") return true;
  return false;
}

function isExpiredEvent(event: ProviderWebhookEvent): boolean {
  const type = event.eventType.toLowerCase();
  const status = (event.status || "").toLowerCase();
  if (status === "expired") return true;
  if (type === "subscription.disable" && (status === "complete" || status === "completed")) return true;
  return false;
}

function isPastDueEvent(event: ProviderWebhookEvent): boolean {
  const type = event.eventType.toLowerCase();
  const status = (event.status || "").toLowerCase();
  if (type === "invoice.payment_failed") return true;
  if (type.includes("payment_failed")) return true;
  if (status === "past_due" || status === "attention" || status === "failed") return true;
  return false;
}

function isAckOnlyEvent(event: ProviderWebhookEvent): boolean {
  const type = event.eventType.toLowerCase();
  return type === "subscription.not_renew" || type === "invoice.create";
}

async function applySubscriptionLifecycle(event: ProviderWebhookEvent): Promise<"applied" | "skipped"> {
  if (isAckOnlyEvent(event)) {
    return "skipped";
  }

  if (isExpiredEvent(event)) {
    await markExpired({ userId: event.userId! });
    return "applied";
  }

  if (isCancellationEvent(event)) {
    await cancelSubscription({ userId: event.userId! });
    return "applied";
  }

  if (isPastDueEvent(event)) {
    await markPastDue({ userId: event.userId! });
    return "applied";
  }

  if (isActivationEvent(event)) {
    if (!event.planCode) {
      throw new WebhookProcessingError("Activation webhook event is missing planCode.");
    }
    await activateSubscription({
      userId: event.userId!,
      planCode: event.planCode,
      provider: event.provider,
      customerId: event.customerId ?? null,
      subscriptionId: event.subscriptionId ?? null,
      currentPeriodStart: event.currentPeriodStart ?? null,
      currentPeriodEnd: event.currentPeriodEnd ?? null
    });
    return "applied";
  }

  return "skipped";
}

export async function processProviderSubscriptionWebhookEvent(
  event: ProviderWebhookEvent
): Promise<WebhookProcessOutcome> {
  if (await hasWebhookEventBeenProcessed(event.provider, event.providerEventId)) {
    return { status: "already_processed" };
  }

  await upsertWebhookEvent(event, { processed: false });

  const userId = await resolveWebhookUserId(event);
  if (!userId) {
    const message =
      "Could not resolve user_subscriptions row for webhook event (missing metadata and no matching payment reference).";
    await markWebhookEventProcessed(event.provider, event.providerEventId, message);
    throw new WebhookProcessingError(message);
  }

  const resolvedEvent: ProviderWebhookEvent = { ...event, userId };

  try {
    const lifecycle = await applySubscriptionLifecycle(resolvedEvent);
    await markWebhookEventProcessed(event.provider, event.providerEventId);

    if (lifecycle === "skipped") {
      return {
        status: "skipped",
        reason: `No lifecycle change for ${event.eventType}`
      };
    }

    return { status: "processed" };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Webhook processing failed.";
    await markWebhookEventProcessed(event.provider, event.providerEventId, message);
    throw e instanceof WebhookProcessingError ? e : new WebhookProcessingError(message);
  }
}

/** @deprecated Prefer processProviderSubscriptionWebhookEvent via handleProviderSubscriptionWebhook. */
export async function applyProviderSubscriptionEvent(event: ProviderWebhookEvent): Promise<void> {
  const outcome = await processProviderSubscriptionWebhookEvent(event);
  if (outcome.status === "already_processed") return;
}

export async function recordCheckoutAttempt(input: RecordCheckoutAttemptInput): Promise<void> {
  const sb = requireServiceRole();
  const { error } = await sb.from("checkout_attempts").insert({
    user_id: input.userId,
    plan_code: input.planCode,
    billing_period: input.billingPeriod,
    provider: input.provider,
    provider_reference: input.providerReference,
    status: input.status ?? "created",
    checkout_url: input.checkoutUrl
  });

  if (error) throw new Error(error.message);
}

export async function getUserSubscriptionPaymentId(userId: string): Promise<string | null> {
  const sb = requireServiceRole();
  const { data, error } = await sb
    .from("user_subscriptions")
    .select("payment_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const id = data?.payment_subscription_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
