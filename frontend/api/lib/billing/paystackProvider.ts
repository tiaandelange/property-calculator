import crypto from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { createServiceRoleSupabase } from "../supabaseServiceRole";
import { readRawBody } from "./readRawBody";
import { BillingConfigError, type PaymentBillingProvider } from "./provider";
import { publicSiteOrigin } from "./siteOrigin";
import { cancelSubscription as syncCancelSubscription } from "./billingSubscriptionSync";
import type { BillingPeriod, ProviderWebhookEvent } from "./types";

const PAYSTACK_API_BASE = "https://api.paystack.co";

type PaystackApiResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

type PaystackInitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

type PaystackSubscriptionData = {
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date?: string;
  customer?: { customer_code?: string };
  plan?: { plan_code?: string };
};

function requirePaystackSecretKey(): string {
  const key = (process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!key) {
    throw new BillingConfigError(
      "PAYSTACK_SECRET_KEY is not configured. Set it in Vercel server environment variables."
    );
  }
  return key;
}

function requireServiceRoleClient() {
  const sb = createServiceRoleSupabase();
  if (!sb) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return sb;
}

async function paystackRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const secret = requirePaystackSecretKey();
  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const payload = (await response.json()) as PaystackApiResponse<T> & { status?: boolean; message?: string };
  if (!response.ok || payload.status !== true) {
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : `Paystack API request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload.data;
}

async function resolvePaystackPlanCode(
  planCode: string,
  billingPeriod: BillingPeriod
): Promise<string> {
  const sb = requireServiceRoleClient();
  const column =
    billingPeriod === "annual" ? "paystack_plan_code_annual" : "paystack_plan_code_monthly";

  const { data, error } = await sb
    .from("subscription_plans")
    .select(`code, name, paystack_plan_code_monthly, paystack_plan_code_annual`)
    .eq("code", planCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new BillingConfigError(`Subscription plan not found: ${planCode}.`);
  }

  const paystackPlanCode = String(
    billingPeriod === "annual" ? data.paystack_plan_code_annual : data.paystack_plan_code_monthly
  ).trim();

  if (!paystackPlanCode) {
    throw new BillingConfigError(
      `Missing ${column} for plan "${planCode}". Configure Paystack plan codes in subscription_plans (see docs/billing/paystack-setup.md).`
    );
  }

  return paystackPlanCode;
}

function buildCheckoutReference(userId: string): string {
  const compactUser = userId.replace(/-/g, "").slice(0, 12);
  return `pg_${compactUser}_${Date.now()}`;
}

function verifyPaystackSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(hash, "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
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

function extractMetadataFields(
  metadata: unknown
): { userId?: string; planCode?: string; billingPeriod?: string } {
  const record = asRecord(metadata);
  if (!record) return {};

  const userId = readString(record.user_id ?? record.userId);
  const planCode = readString(record.plan_code ?? record.planCode);
  const billingPeriod = readString(record.billing_period ?? record.billingPeriod);

  const customFields = record.custom_fields;
  if (Array.isArray(customFields)) {
    let resolvedUserId = userId;
    let resolvedPlanCode = planCode;
    let resolvedBillingPeriod = billingPeriod;
    for (const field of customFields) {
      const row = asRecord(field);
      if (!row) continue;
      const variable = readString(row.variable_name ?? row.variableName);
      const value = readString(row.value);
      if (!variable || !value) continue;
      if (variable === "user_id" || variable === "userId") resolvedUserId = value;
      if (variable === "plan_code" || variable === "planCode") resolvedPlanCode = value;
      if (variable === "billing_period" || variable === "billingPeriod") {
        resolvedBillingPeriod = value;
      }
    }
    return {
      userId: resolvedUserId,
      planCode: resolvedPlanCode,
      billingPeriod: resolvedBillingPeriod
    };
  }

  return { userId, planCode, billingPeriod };
}

async function resolvePlanCodeFromPaystackPlan(paystackPlanCode: string | undefined): Promise<string | undefined> {
  if (!paystackPlanCode) return undefined;
  const sb = requireServiceRoleClient();
  const { data, error } = await sb
    .from("subscription_plans")
    .select("code, paystack_plan_code_monthly, paystack_plan_code_annual")
    .or(
      `paystack_plan_code_monthly.eq.${paystackPlanCode},paystack_plan_code_annual.eq.${paystackPlanCode}`
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  return readString(data?.code);
}

function mapPaystackStatus(
  rawStatus: string | undefined,
  eventType: string,
  data?: Record<string, unknown>
): string | undefined {
  const status = (rawStatus || "").trim().toLowerCase();
  const type = eventType.toLowerCase();

  if (type === "subscription.not_renew") {
    return "cancelled";
  }
  if (type === "invoice.payment_failed") {
    return "past_due";
  }
  if (type === "invoice.update") {
    const paid = data?.paid;
    if (paid === true || paid === 1 || paid === "1") {
      return "active";
    }
  }
  if (type.includes("payment_failed") || status === "attention") {
    return "past_due";
  }
  if (status === "cancelled" || status === "canceled" || status === "non-renewing" || status === "non_renewing") {
    return "cancelled";
  }
  if (status === "complete" || status === "completed" || status === "expired") {
    return "expired";
  }
  if (status === "success" || status === "active" || status === "paid") {
    return "active";
  }
  return status || undefined;
}

function buildProviderEventId(eventType: string, data: Record<string, unknown>): string {
  const reference = readString(data.reference);
  const transactionId = data.id != null ? String(data.id) : undefined;
  const subscription = asRecord(data.subscription);
  const subscriptionCode =
    readString(data.subscription_code) ?? readString(subscription?.subscription_code);
  const invoiceCode = readString(data.invoice_code);

  if (reference) return `${eventType}:${reference}`;
  if (subscriptionCode) return `${eventType}:${subscriptionCode}`;
  if (invoiceCode) return `${eventType}:${invoiceCode}`;
  if (transactionId) return `${eventType}:${transactionId}`;
  return `${eventType}:${crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 24)}`;
}

function extractPeriodDates(data: Record<string, unknown>): {
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
} {
  const start = readString(data.period_start) ?? readString(data.paid_at);
  const end = readString(data.period_end) ?? readString(data.next_payment_date);
  return {
    ...(start ? { currentPeriodStart: start } : {}),
    ...(end ? { currentPeriodEnd: end } : {})
  };
}

export async function normalizePaystackWebhookEvent(
  eventType: string,
  data: Record<string, unknown>
): Promise<ProviderWebhookEvent> {
  const metadata = extractMetadataFields(data.metadata);
  const customer = asRecord(data.customer);
  const plan = asRecord(data.plan) ?? asRecord(asRecord(data.subscription)?.plan);
  const subscription = asRecord(data.subscription);

  const paystackPlanCode = readString(plan?.plan_code);
  const planCode =
    metadata.planCode ?? (await resolvePlanCodeFromPaystackPlan(paystackPlanCode));

  const subscriptionId =
    readString(data.subscription_code) ?? readString(subscription?.subscription_code);
  const customerId = readString(customer?.customer_code) ?? readString(data.customer_code);
  const status = mapPaystackStatus(
    readString(data.status) ?? readString(subscription?.status),
    eventType,
    data
  );
  const period = extractPeriodDates({
    ...data,
    ...(subscription ?? {}),
    next_payment_date: data.next_payment_date ?? subscription?.next_payment_date
  });

  return {
    provider: "paystack",
    providerEventId: buildProviderEventId(eventType, data),
    eventType,
    payload: { event: eventType, data },
    ...(metadata.userId ? { userId: metadata.userId } : {}),
    ...(planCode ? { planCode } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(status ? { status } : {}),
    ...period
  };
}

export const paystackBillingProvider: PaymentBillingProvider = {
  name: "paystack",

  async createCheckoutSession(input) {
    const paystackPlanCode = await resolvePaystackPlanCode(input.planCode, input.billingPeriod);
    const reference = buildCheckoutReference(input.userId);
    const callbackUrl = `${publicSiteOrigin()}/subscription/success`;

    /**
     * Paystack subscriptions are started by initializing a transaction with a plan code.
     * The plan amount/interval on Paystack overrides `amount`. After the customer pays,
     * Paystack creates the subscription and sends charge.success + subscription.create webhooks.
     * @see https://paystack.com/docs/payments/subscriptions/
     * @see https://paystack.com/docs/api/transaction/#initialize
     */
    const data = await paystackRequest<PaystackInitializeData>("POST", "/transaction/initialize", {
      email: input.email,
      plan: paystackPlanCode,
      reference,
      callback_url: callbackUrl,
      metadata: {
        user_id: input.userId,
        plan_code: input.planCode,
        billing_period: input.billingPeriod
      }
    });

    if (!data.authorization_url || !data.reference) {
      throw new Error("Paystack did not return an authorization URL.");
    }

    return {
      checkoutUrl: data.authorization_url,
      reference: data.reference
    };
  },

  async verifyWebhook(req: VercelRequest) {
    const secret = requirePaystackSecretKey();
    const signature = req.headers["x-paystack-signature"];
    if (typeof signature !== "string" || !signature.trim()) {
      throw new Error("Missing x-paystack-signature header.");
    }

    const rawBody = await readRawBody(req);
    if (!verifyPaystackSignature(rawBody, signature.trim(), secret)) {
      throw new Error("Invalid Paystack webhook signature.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new Error("Invalid Paystack webhook JSON body.");
    }

    const envelope = asRecord(parsed);
    const eventType = readString(envelope?.event);
    const data = asRecord(envelope?.data);
    if (!eventType || !data) {
      throw new Error("Paystack webhook payload is missing event or data.");
    }

    return normalizePaystackWebhookEvent(eventType, data);
  },

  async cancelSubscription(input) {
    const subscriptionCode = readString(input.subscriptionId);
    if (!subscriptionCode) {
      throw new Error("No Paystack subscription is linked to this account.");
    }

    /**
     * Paystack disable requires subscription code + email_token.
     * Fetch the subscription first because we only persist subscription_code locally.
     * @see https://paystack.com/docs/api/subscription/#disable
     */
    const subscription = await paystackRequest<PaystackSubscriptionData>(
      "GET",
      `/subscription/${encodeURIComponent(subscriptionCode)}`
    );

    const emailToken = readString(subscription.email_token);
    if (!emailToken) {
      throw new Error("Paystack subscription email_token is missing; cannot disable subscription.");
    }

    await paystackRequest("POST", "/subscription/disable", {
      code: subscriptionCode,
      token: emailToken
    });

    await syncCancelSubscription({ userId: input.userId });
  }
};
