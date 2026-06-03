import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";

/** Signup/marketing trial length when not stored on subscription_plans (portfolio only). */
export function planSignupTrialDays(code: string): number {
  return code === "portfolio" ? 14 : 0;
}

export type SubscriptionPlanRecord = {
  /** Stable id for UI keys; equals plan code after v2 schema. */
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  currency: string;
  /** Derived for signup/pricing display (not a DB column in v2). */
  trialDays: number;
  maxProperties: number | null;
  maxReportsPerMonth: number | null;
  maxApplicationLinks: number | null;
  maxUnits: number | null;
  hasBasicManagement: boolean;
  hasBasicCalculators: boolean;
  hasFullAnalytics: boolean;
  hasIrr: boolean;
  hasGraphs: boolean;
  hasForecasting: boolean;
  hasPortfolioDashboard: boolean;
  hasPropertyComparison: boolean;
  hasAdvancedReports: boolean;
  hasUnlimitedReports: boolean;
  hasApplicationLinks: boolean;
  hasReportBranding: boolean;
  hasTeamAccess: boolean;
  hasPrioritySupport: boolean;
  sortOrder: number;
  /** @deprecated Use maxProperties — kept for existing UI/helpers. */
  propertyLimit: number | null;
  /** @deprecated Use maxReportsPerMonth */
  reportLimit: number | null;
  /** @deprecated Use hasBasicCalculators */
  includesCalculators: boolean;
  /** @deprecated Use hasBasicManagement */
  includesManagement: boolean;
  /** @deprecated Use hasUnlimitedReports */
  includesUnlimitedReports: boolean;
};

const PLAN_SELECT_COLUMNS =
  "code, name, description, monthly_price, currency, max_properties, max_reports_per_month, max_application_links, max_units, has_basic_management, has_basic_calculators, has_full_analytics, has_irr, has_graphs, has_forecasting, has_portfolio_dashboard, has_property_comparison, has_advanced_reports, has_unlimited_reports, has_application_links, has_report_branding, has_team_access, has_priority_support, sort_order" as const;

function numOrNull(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    if (row[key] != null) return Number(row[key]);
  }
  return null;
}

function mapPlanRow(row: Record<string, unknown>): SubscriptionPlanRecord {
  const code = String(row.code ?? "");
  const maxProperties = numOrNull(row, "max_properties", "property_limit", "propertyLimit");
  const maxReportsPerMonth = numOrNull(row, "max_reports_per_month", "report_limit", "reportLimit");
  const hasBasicManagement = Boolean(
    row.has_basic_management ?? row.includes_management ?? row.includesManagement ?? true
  );
  const hasBasicCalculators = Boolean(
    row.has_basic_calculators ?? row.includes_calculators ?? row.includesCalculators ?? true
  );
  const hasUnlimitedReports = Boolean(
    row.has_unlimited_reports ?? row.includes_unlimited_reports ?? row.includesUnlimitedReports
  );

  return {
    id: code,
    code,
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : null,
    monthlyPrice: Number(row.monthly_price ?? row.monthlyPrice ?? 0),
    currency: String(row.currency ?? "ZAR"),
    trialDays: Number(row.trial_days ?? row.trialDays ?? planSignupTrialDays(code)),
    maxProperties,
    maxReportsPerMonth,
    maxApplicationLinks: numOrNull(row, "max_application_links", "maxApplicationLinks"),
    maxUnits: numOrNull(row, "max_units", "maxUnits"),
    hasBasicManagement,
    hasBasicCalculators,
    hasFullAnalytics: Boolean(row.has_full_analytics ?? row.hasFullAnalytics),
    hasIrr: Boolean(row.has_irr ?? row.hasIrr),
    hasGraphs: Boolean(row.has_graphs ?? row.hasGraphs),
    hasForecasting: Boolean(row.has_forecasting ?? row.hasForecasting),
    hasPortfolioDashboard: Boolean(row.has_portfolio_dashboard ?? row.hasPortfolioDashboard),
    hasPropertyComparison: Boolean(row.has_property_comparison ?? row.hasPropertyComparison),
    hasAdvancedReports: Boolean(row.has_advanced_reports ?? row.hasAdvancedReports),
    hasUnlimitedReports,
    hasApplicationLinks: Boolean(row.has_application_links ?? row.hasApplicationLinks),
    hasReportBranding: Boolean(row.has_report_branding ?? row.hasReportBranding),
    hasTeamAccess: Boolean(row.has_team_access ?? row.hasTeamAccess),
    hasPrioritySupport: Boolean(row.has_priority_support ?? row.hasPrioritySupport),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    propertyLimit: maxProperties,
    reportLimit: maxReportsPerMonth,
    includesCalculators: hasBasicCalculators,
    includesManagement: hasBasicManagement,
    includesUnlimitedReports: hasUnlimitedReports
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
    .select(PLAN_SELECT_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return FALLBACK_SUBSCRIPTION_PLANS;
  return data.map((row) => mapPlanRow(row as Record<string, unknown>));
}

/** Offline fallback aligned with supabase seed migration. */
export const FALLBACK_SUBSCRIPTION_PLANS: SubscriptionPlanRecord[] = [
  {
    id: "starter",
    code: "starter",
    name: "Starter",
    description: "Free plan for your first properties — basic management and calculators.",
    monthlyPrice: 0,
    currency: "ZAR",
    trialDays: 0,
    maxProperties: 3,
    maxReportsPerMonth: 3,
    maxApplicationLinks: 1,
    maxUnits: null,
    hasBasicManagement: true,
    hasBasicCalculators: true,
    hasFullAnalytics: false,
    hasIrr: false,
    hasGraphs: false,
    hasForecasting: false,
    hasPortfolioDashboard: false,
    hasPropertyComparison: false,
    hasAdvancedReports: false,
    hasUnlimitedReports: false,
    hasApplicationLinks: false,
    hasReportBranding: false,
    hasTeamAccess: false,
    hasPrioritySupport: false,
    sortOrder: 10,
    propertyLimit: 3,
    reportLimit: 3,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: false
  },
  {
    id: "investor",
    code: "investor",
    name: "Investor",
    description: "For owner-managers and small portfolio investors.",
    monthlyPrice: 299,
    currency: "ZAR",
    trialDays: 0,
    maxProperties: 10,
    maxReportsPerMonth: 10,
    maxApplicationLinks: 10,
    maxUnits: null,
    hasBasicManagement: true,
    hasBasicCalculators: true,
    hasFullAnalytics: true,
    hasIrr: true,
    hasGraphs: true,
    hasForecasting: true,
    hasPortfolioDashboard: true,
    hasPropertyComparison: true,
    hasAdvancedReports: false,
    hasUnlimitedReports: false,
    hasApplicationLinks: true,
    hasReportBranding: false,
    hasTeamAccess: false,
    hasPrioritySupport: false,
    sortOrder: 20,
    propertyLimit: 10,
    reportLimit: 10,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: false
  },
  {
    id: "portfolio",
    code: "portfolio",
    name: "Portfolio",
    description: "For serious property investors managing a growing portfolio.",
    monthlyPrice: 599,
    currency: "ZAR",
    trialDays: 14,
    maxProperties: 30,
    maxReportsPerMonth: null,
    maxApplicationLinks: null,
    maxUnits: null,
    hasBasicManagement: true,
    hasBasicCalculators: true,
    hasFullAnalytics: true,
    hasIrr: true,
    hasGraphs: true,
    hasForecasting: true,
    hasPortfolioDashboard: true,
    hasPropertyComparison: true,
    hasAdvancedReports: true,
    hasUnlimitedReports: true,
    hasApplicationLinks: true,
    hasReportBranding: false,
    hasTeamAccess: false,
    hasPrioritySupport: true,
    sortOrder: 30,
    propertyLimit: 30,
    reportLimit: null,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: true
  },
  {
    id: "portfolio_pro",
    code: "portfolio_pro",
    name: "Portfolio Pro",
    description: "For larger owner-managed portfolios and advanced reporting.",
    monthlyPrice: 999,
    currency: "ZAR",
    trialDays: 0,
    maxProperties: null,
    maxReportsPerMonth: null,
    maxApplicationLinks: null,
    maxUnits: null,
    hasBasicManagement: true,
    hasBasicCalculators: true,
    hasFullAnalytics: true,
    hasIrr: true,
    hasGraphs: true,
    hasForecasting: true,
    hasPortfolioDashboard: true,
    hasPropertyComparison: true,
    hasAdvancedReports: true,
    hasUnlimitedReports: true,
    hasApplicationLinks: true,
    hasReportBranding: true,
    hasTeamAccess: true,
    hasPrioritySupport: true,
    sortOrder: 40,
    propertyLimit: null,
    reportLimit: null,
    includesCalculators: true,
    includesManagement: true,
    includesUnlimitedReports: true
  }
];
