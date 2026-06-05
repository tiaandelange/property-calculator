import type { VercelRequest } from "@vercel/node";
import { createServiceRoleSupabase } from "../supabaseServiceRole";
import type { BillingPeriod } from "./types";

export const CHECKOUT_PLAN_CODES = ["starter", "investor", "portfolio", "portfolio_pro"] as const;

export type CheckoutPlanCode = (typeof CHECKOUT_PLAN_CODES)[number];

export class CheckoutValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutValidationError";
    this.status = status;
  }
}

export type SubscriptionPlanRow = {
  code: string;
  name: string;
  monthlyPrice: number;
  isActive: boolean;
};

export type ParsedCheckoutRequest = {
  planCode: CheckoutPlanCode;
  billingPeriod: BillingPeriod;
};

function isCheckoutPlanCode(value: string): value is CheckoutPlanCode {
  return (CHECKOUT_PLAN_CODES as readonly string[]).includes(value);
}

function parseBillingPeriod(raw: unknown): BillingPeriod | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "monthly" || value === "annual") return value;
  return null;
}

export function parseCheckoutRequest(req: VercelRequest): ParsedCheckoutRequest {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  const planCodeRaw = String(body.planCode ?? "").trim().toLowerCase();
  if (!planCodeRaw) {
    throw new CheckoutValidationError("planCode is required.");
  }
  if (!isCheckoutPlanCode(planCodeRaw)) {
    throw new CheckoutValidationError(
      `Invalid planCode. Allowed values: ${CHECKOUT_PLAN_CODES.join(", ")}.`
    );
  }

  const billingPeriod = parseBillingPeriod(body.billingPeriod);
  if (!billingPeriod) {
    throw new CheckoutValidationError('billingPeriod is required and must be "monthly" or "annual".');
  }

  return { planCode: planCodeRaw, billingPeriod };
}

export async function fetchSubscriptionPlanByCode(planCode: string): Promise<SubscriptionPlanRow> {
  const sb = createServiceRoleSupabase();
  if (!sb) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { data, error } = await sb
    .from("subscription_plans")
    .select("code, name, monthly_price, is_active")
    .eq("code", planCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new CheckoutValidationError(`Plan not found: ${planCode}.`, 404);
  }

  return {
    code: String(data.code),
    name: String(data.name ?? planCode),
    monthlyPrice: Number(data.monthly_price ?? 0),
    isActive: Boolean(data.is_active)
  };
}

export function assertCheckoutAllowedForPlan(plan: SubscriptionPlanRow): void {
  if (!plan.isActive) {
    throw new CheckoutValidationError(`Plan "${plan.name}" is not available for checkout.`, 404);
  }

  if (plan.code === "starter" || plan.monthlyPrice <= 0) {
    throw new CheckoutValidationError("Starter is free and does not require checkout.");
  }
}

export function requireCheckoutEmail(email: string | null | undefined): string {
  const normalized = String(email ?? "").trim();
  if (!normalized) {
    throw new CheckoutValidationError("A verified account email is required for checkout.");
  }
  return normalized;
}
