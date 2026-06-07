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
  applicationLinksActive: number;
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
    return { propertyCount: 0, investmentReportCount: 0, applicationLinksActive: 0, period };
  }

  const sb = getSupabase();
  const { data: sessionWrap, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) {
    console.warn("[usage] getSession", sessionErr.message);
    return { propertyCount: 0, investmentReportCount: 0, applicationLinksActive: 0, period };
  }
  const user = sessionWrap.session?.user ?? null;
  if (!user) {
    return { propertyCount: 0, investmentReportCount: 0, applicationLinksActive: 0, period };
  }

  const periodStart = period.start.toISOString();
  const periodEnd = period.end.toISOString();

  const [
    { count: propertyCount, error: propErr },
    { count: storedReportCount, error: storedErr },
    { count: investmentTableCount, error: invErr },
    { count: inviteCount, error: inviteErr },
    entitlementsRes
  ] = await Promise.all([
    sb.from("properties").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb
      .from("stored_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("report_type", ["CALCULATION", "INVESTMENT_REPORT", "PROPERTY_SUMMARY"])
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd),
    sb
      .from("investment_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd),
    sb
      .from("applicant_invites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null),
    sb.rpc("get_user_plan_entitlements").then((r) => r)
  ]);

  if (propErr) throw new Error(propErr.message);
  if (storedErr && !isMissingTable(storedErr)) throw new Error(storedErr.message);
  if (invErr && !isMissingTable(invErr)) throw new Error(invErr.message);
  if (inviteErr) throw new Error(inviteErr.message);

  const ent = entitlementsRes.data as {
    usage?: { reportsGenerated?: number };
  } | null;
  const counterReports = Number(ent?.usage?.reportsGenerated ?? 0);
  const tableReports = Math.max(storedReportCount ?? 0, investmentTableCount ?? 0);

  return {
    propertyCount: propertyCount ?? 0,
    investmentReportCount: Math.max(counterReports, tableReports),
    applicationLinksActive: inviteCount ?? 0,
    period
  };
}

function isMissingTable(err: { code?: string; message?: string }): boolean {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  return code === "42P01" || msg.includes("does not exist");
}
