import { calendarMonthPeriod } from "../lib/subscriptionPeriod";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import type { UserSubscriptionRecord } from "./userSubscriptionsSupabase";

export type SubscriptionUsagePeriod = {
  start: Date;
  end: Date;
  label: string;
};

export type SubscriptionUsageCounts = {
  propertyCount: number;
  investmentReportCount: number;
  period: SubscriptionUsagePeriod;
};

/** Window for investment report usage (CALCULATION stored_reports). */
export function getSubscriptionUsagePeriod(
  subscription: UserSubscriptionRecord | null
): SubscriptionUsagePeriod {
  const now = new Date();

  if (subscription?.status === "trialing" && subscription.trialStart && subscription.trialEnd) {
    return {
      start: new Date(subscription.trialStart),
      end: new Date(subscription.trialEnd),
      label: "Trial period"
    };
  }

  if (subscription?.currentPeriodStart && subscription?.currentPeriodEnd) {
    return {
      start: new Date(subscription.currentPeriodStart),
      end: new Date(subscription.currentPeriodEnd),
      label: "Current billing period"
    };
  }

  const start = calendarMonthPeriod(now).start;
  const end = calendarMonthPeriod(now).end;
  return { start, end, label: "This calendar month" };
}

export async function fetchSubscriptionUsageCounts(
  subscription: UserSubscriptionRecord | null
): Promise<SubscriptionUsageCounts> {
  const period = getSubscriptionUsagePeriod(subscription);

  if (!isSupabaseConfigured) {
    return { propertyCount: 0, investmentReportCount: 0, period };
  }

  const sb = getSupabase();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) {
    return { propertyCount: 0, investmentReportCount: 0, period };
  }

  const { count: propertyCount, error: propErr } = await sb
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (propErr) throw new Error(propErr.message);

  let reportQuery = sb
    .from("stored_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("report_type", "CALCULATION")
    .gte("created_at", period.start.toISOString())
    .lt("created_at", period.end.toISOString());

  const { count: investmentReportCount, error: reportErr } = await reportQuery;
  if (reportErr) throw new Error(reportErr.message);

  return {
    propertyCount: propertyCount ?? 0,
    investmentReportCount: investmentReportCount ?? 0,
    period
  };
}
