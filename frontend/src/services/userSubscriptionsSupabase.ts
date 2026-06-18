import { calendarMonthIsoBounds } from "../lib/subscriptionPeriod";
import { readAuthSession } from "../lib/authSession";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "./subscriptionPlansSupabase";
import { isSignupPlanCode } from "../features/signup/signupPlan";

export type UserSubscriptionRecord = {
  id: string;
  userId: string;
  planCode: string;
  status: string;
  trialStart: string | null;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  paymentProvider: string | null;
  paymentSubscriptionId: string | null;
};

// Payment activation and provider fields are updated via service role only (billing API + webhooks).

/** Initial row fields for a newly registered user (no payment provider). */
export function buildInitialUserSubscriptionFields(plan: SubscriptionPlanRecord): {
  plan_code: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
} {
  const now = new Date();

  if (plan.monthlyPrice === 0) {
    const period = calendarMonthIsoBounds(now);
    return {
      plan_code: plan.code,
      status: "active",
      trial_start: null,
      trial_end: null,
      current_period_start: period.start,
      current_period_end: period.end
    };
  }

  if (plan.trialDays > 0) {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + plan.trialDays);
    return {
      plan_code: plan.code,
      status: "trialing",
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: null,
      current_period_end: null
    };
  }

  return {
    plan_code: plan.code,
    status: "pending_payment",
    trial_start: null,
    trial_end: null,
    current_period_start: null,
    current_period_end: null
  };
}

function mapUserSubscriptionRow(row: Record<string, unknown>): UserSubscriptionRecord {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    planCode: String(row.plan_code ?? row.planCode ?? ""),
    status: String(row.status ?? ""),
    trialStart: row.trial_start != null ? String(row.trial_start) : null,
    trialEnd: row.trial_end != null ? String(row.trial_end) : null,
    currentPeriodStart:
      row.current_period_start != null ? String(row.current_period_start) : null,
    currentPeriodEnd: row.current_period_end != null ? String(row.current_period_end) : null,
    paymentProvider: row.payment_provider != null ? String(row.payment_provider) : null,
    paymentSubscriptionId:
      row.payment_subscription_id != null ? String(row.payment_subscription_id) : null
  };
}

export async function getUserSubscriptionForCurrentUser(): Promise<UserSubscriptionRecord | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabase();
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw sessionErr;
  const user = session?.user ?? null;
  if (!user) return null;

  const { data, error } = await sb
    .from("user_subscriptions")
    .select(
      "id, user_id, plan_code, status, trial_start, trial_end, current_period_start, current_period_end, payment_provider, payment_subscription_id"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapUserSubscriptionRow(data as Record<string, unknown>);
}

/**
 * Ensures the signed-in user has a Starter (free) subscription row.
 * Idempotent — does not overwrite an existing row.
 */
export async function ensureDefaultStarterSubscription(): Promise<{
  created: boolean;
  skipped: boolean;
}> {
  return ensureUserSubscriptionForPlanCode("starter");
}

/**
 * Creates `user_subscriptions` for the signed-in user if none exists.
 * Idempotent: does not overwrite an existing row.
 */
export async function ensureUserSubscriptionForPlanCode(
  planCode: string
): Promise<{ created: boolean; skipped: boolean }> {
  if (!isSupabaseConfigured) {
    return { created: false, skipped: true };
  }

  if (!isSignupPlanCode(planCode)) {
    throw new Error(`Invalid signup plan code: ${planCode}`);
  }

  const sb = getSupabase();
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw sessionErr;
  const user = session?.user ?? null;
  if (!user) {
    return { created: false, skipped: true };
  }

  const { data: existing, error: existingErr } = await sb
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);
  if (existing) {
    return { created: false, skipped: true };
  }

  const plans = await listActiveSubscriptionPlans().catch(() => FALLBACK_SUBSCRIPTION_PLANS);
  const plan = plans.find((p) => p.code === planCode);
  if (!plan) {
    throw new Error(`Plan not found: ${planCode}`);
  }

  const initial = buildInitialUserSubscriptionFields(plan);
  const { error: insertErr } = await sb.from("user_subscriptions").insert({
    user_id: user.id,
    plan_code: initial.plan_code,
    status: initial.status,
    trial_start: initial.trial_start,
    trial_end: initial.trial_end,
    current_period_start: initial.current_period_start,
    current_period_end: initial.current_period_end,
    payment_provider: null,
    payment_customer_id: null,
    payment_subscription_id: null
  });

  if (insertErr) throw new Error(insertErr.message);
  return { created: true, skipped: false };
}

/**
 * Updates plan selection for testing / pre-payment access. Does not charge or touch payment_* fields.
 */
export async function updateUserSubscriptionPlanCode(
  planCode: string,
  opts?: { requireAdmin?: boolean }
): Promise<UserSubscriptionRecord> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  if (!isSignupPlanCode(planCode)) {
    throw new Error(`Invalid plan code: ${planCode}`);
  }

  const sb = getSupabase();
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw sessionErr;
  const user = session?.user ?? null;
  if (!user) throw new Error("Not signed in.");

  if (opts?.requireAdmin !== false) {
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (profile?.role !== "ADMIN") {
      throw new Error("Only administrators can change plans from settings.");
    }
  }

  const plans = await listActiveSubscriptionPlans().catch(() => FALLBACK_SUBSCRIPTION_PLANS);
  const plan = plans.find((p) => p.code === planCode);
  if (!plan) throw new Error(`Plan not found: ${planCode}`);

  const initial = buildInitialUserSubscriptionFields(plan);
  const { data, error } = await sb
    .from("user_subscriptions")
    .update({
      plan_code: initial.plan_code,
      status: initial.status,
      trial_start: initial.trial_start,
      trial_end: initial.trial_end,
      current_period_start: initial.current_period_start,
      current_period_end: initial.current_period_end
    })
    .eq("user_id", user.id)
    .select(
      "id, user_id, plan_code, status, trial_start, trial_end, current_period_start, current_period_end, payment_provider, payment_subscription_id"
    )
    .single();

  if (error) throw new Error(error.message);
  return mapUserSubscriptionRow(data as Record<string, unknown>);
}
