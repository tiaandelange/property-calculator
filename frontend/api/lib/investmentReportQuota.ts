import type { SupabaseClient } from "@supabase/supabase-js";

/** Enforces plan report quota via Postgres RPC (SECURITY DEFINER). */
export async function assertInvestmentReportQuota(sb: SupabaseClient): Promise<string | null> {
  const { error } = await sb.rpc("assert_investment_report_quota");
  if (!error) return null;
  return error.message ?? "Report limit reached.";
}

/** Increments usage_counters.reports_generated for the current UTC month. */
export async function recordInvestmentReportGenerated(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.rpc("increment_usage_reports_generated", { p_delta: 1 });
  if (error) {
    console.warn("[usage] increment_usage_reports_generated", error.message);
  }
}
