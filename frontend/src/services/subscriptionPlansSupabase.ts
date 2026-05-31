import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";

export type SubscriptionPlanRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  currency: string;
  trialDays: number;
  propertyLimit: number | null;
  reportLimit: number | null;
  includesCalculators: boolean;
  includesManagement: boolean;
  includesUnlimitedReports: boolean;
  sortOrder: number;
};

function mapPlanRow(row: Record<string, unknown>): SubscriptionPlanRecord {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : null,
    monthlyPrice: Number(row.monthly_price ?? row.monthlyPrice ?? 0),
    currency: String(row.currency ?? "ZAR"),
    trialDays: Number(row.trial_days ?? row.trialDays ?? 0),
    propertyLimit:
      row.property_limit != null
        ? Number(row.property_limit)
        : row.propertyLimit != null
          ? Number(row.propertyLimit)
          : null,
    reportLimit:
      row.report_limit != null
        ? Number(row.report_limit)
        : row.reportLimit != null
          ? Number(row.reportLimit)
          : null,
    includesCalculators: Boolean(row.includes_calculators ?? row.includesCalculators),
    includesManagement: Boolean(row.includes_management ?? row.includesManagement),
    includesUnlimitedReports: Boolean(row.includes_unlimited_reports ?? row.includesUnlimitedReports),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0)
  };
}

/** Active plans for public pricing (anon-readable via RLS). */
export async function listActiveSubscriptionPlans(): Promise<SubscriptionPlanRecord[]> {
  if (!isSupabaseConfigured) {
    return FALLBACK_SUBSCRIPTION_PLANS;
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("subscription_plans")
    .select(
      "id, code, name, description, monthly_price, currency, trial_days, property_limit, report_limit, includes_calculators, includes_management, includes_unlimited_reports, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return FALLBACK_SUBSCRIPTION_PLANS;
  return data.map((row) => mapPlanRow(row as Record<string, unknown>));
}

/** Offline fallback aligned with supabase seed migration. */
export const FALLBACK_SUBSCRIPTION_PLANS: SubscriptionPlanRecord[] = [
  {
    id: "fallback-starter",
    code: "starter",
    name: "Starter",
    description: "Free plan for your first properties — 3 investment reports per month.",
    monthlyPrice: 0,
    currency: "ZAR",
    trialDays: 0,
    propertyLimit: 3,
    reportLimit: 3,
    includesCalculators: false,
    includesManagement: false,
    includesUnlimitedReports: false,
    sortOrder: 10
  },
  {
    id: "fallback-investor",
    code: "investor",
    name: "Investor",
    description: "For owner-managers and small portfolio investors.",
    monthlyPrice: 299,
    currency: "ZAR",
    trialDays: 0,
    propertyLimit: 10,
    reportLimit: 10,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: false,
    sortOrder: 20
  },
  {
    id: "fallback-portfolio",
    code: "portfolio",
    name: "Portfolio",
    description: "For serious property investors managing a growing portfolio.",
    monthlyPrice: 599,
    currency: "ZAR",
    trialDays: 14,
    propertyLimit: 30,
    reportLimit: null,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: true,
    sortOrder: 30
  },
  {
    id: "fallback-portfolio_pro",
    code: "portfolio_pro",
    name: "Portfolio Pro",
    description: "For larger owner-managed portfolios and advanced reporting.",
    monthlyPrice: 999,
    currency: "ZAR",
    trialDays: 0,
    propertyLimit: 75,
    reportLimit: null,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: true,
    sortOrder: 40
  }
];
