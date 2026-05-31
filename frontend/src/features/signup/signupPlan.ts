import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";

/** Plan codes accepted from /signup?plan=… (pricing funnel). */
export const SIGNUP_PLAN_CODES = ["starter", "investor", "portfolio", "portfolio_pro"] as const;

export type SignupPlanCode = (typeof SIGNUP_PLAN_CODES)[number];

export const PENDING_SIGNUP_PLAN_STORAGE_KEY = "pg_pending_signup_plan_code";

export const SIGNUP_PLAN_USER_METADATA_KEY = "plan_code";

export function isSignupPlanCode(code: string): code is SignupPlanCode {
  return (SIGNUP_PLAN_CODES as readonly string[]).includes(code);
}

export type SignupPlanResolution = {
  plan: SubscriptionPlanRecord;
  /** User supplied ?plan= that is not a known active code. */
  invalidRequested: boolean;
  /** Show plan summary card (signup route or valid plan query on login/signup). */
  showSummary: boolean;
};

/**
 * Resolves which plan to associate with signup.
 * - /signup with no param → Starter
 * - /signup?plan=invalid → Starter + invalid flag
 * - /login with no plan param → no summary
 */
export function resolveSignupPlanSelection(
  pathname: string,
  rawPlanCode: string,
  plans: SubscriptionPlanRecord[]
): SignupPlanResolution {
  const starter = plans.find((p) => p.code === "starter") ?? plans[0];
  const onSignupRoute = pathname === "/signup";
  const trimmed = rawPlanCode.trim();

  if (!onSignupRoute && !trimmed) {
    return { plan: starter, invalidRequested: false, showSummary: false };
  }

  if (!trimmed) {
    return { plan: starter, invalidRequested: false, showSummary: true };
  }

  const match = plans.find((p) => p.code === trimmed && isSignupPlanCode(p.code));
  if (match) {
    return { plan: match, invalidRequested: false, showSummary: true };
  }

  return { plan: starter, invalidRequested: true, showSummary: true };
}
