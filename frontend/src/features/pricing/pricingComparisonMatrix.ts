import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import {
  type BillingPeriod,
  formatAnnualPlanTotal,
  formatPlanPrice,
  annualPlanTotal,
  isFreePlan
} from "./pricingPlanDisplay";

export const PRICING_PLAN_CODES = ["starter", "investor", "portfolio", "portfolio_pro"] as const;

export type PricingPlanCode = (typeof PRICING_PLAN_CODES)[number];

export type ComparisonCellValue =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "text"; text: string };

export type ComparisonRow = {
  id: string;
  label: string;
  values: Record<PricingPlanCode, ComparisonCellValue>;
};

const yes: ComparisonCellValue = { kind: "yes" };
const no: ComparisonCellValue = { kind: "no" };
const label = (text: string): ComparisonCellValue => ({ kind: "text", text });

function tier(
  starter: ComparisonCellValue,
  investor: ComparisonCellValue,
  portfolio: ComparisonCellValue,
  portfolioPro: ComparisonCellValue
): Record<PricingPlanCode, ComparisonCellValue> {
  return { starter, investor, portfolio, portfolio_pro: portfolioPro };
}

/**
 * Feature matrix for the pricing page comparison table only.
 * Copy is fixed for marketing clarity; plan catalog / gating logic is unchanged.
 */
function comparisonPriceLabel(plan: SubscriptionPlanRecord, billing: BillingPeriod): string {
  if (isFreePlan(plan)) return "Free";
  if (billing === "annual") {
    return formatAnnualPlanTotal(annualPlanTotal(plan.monthlyPrice), plan.currency);
  }
  return formatPlanPrice(plan.monthlyPrice, plan.currency);
}

export function buildPricingComparisonRows(
  plans: SubscriptionPlanRecord[],
  billing: BillingPeriod = "monthly"
): ComparisonRow[] {
  const byCode = Object.fromEntries(plans.map((p) => [p.code, p])) as Partial<
    Record<PricingPlanCode, SubscriptionPlanRecord>
  >;
  const priceFor = (code: PricingPlanCode, fallback: string): ComparisonCellValue => {
    const plan = byCode[code];
    return label(plan ? comparisonPriceLabel(plan, billing) : fallback);
  };

  return [
    {
      id: "monthly_price",
      label: billing === "annual" ? "Annual price" : "Monthly price",
      values: tier(
        priceFor("starter", "Free"),
        priceFor("investor", "R299/month"),
        priceFor("portfolio", "R599/month"),
        priceFor("portfolio_pro", "R999/month")
      )
    },
    {
      id: "property_limit",
      label: "Property limit",
      values: tier(label("3"), label("10"), label("30"), label("Unlimited"))
    },
    {
      id: "reports_per_month",
      label: "Reports/month",
      values: tier(
        label("3 basic reports"),
        label("10 investment reports"),
        label("Unlimited"),
        label("Unlimited")
      )
    },
    {
      id: "basic_property_management",
      label: "Basic property management",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "tenants_leases_invoices",
      label: "Tenants, leases, invoices, statements",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "basic_calculators",
      label: "Basic calculators",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "full_analytics_dashboard",
      label: "Full analytics dashboard",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "irr_calculations",
      label: "IRR calculations",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "graphs_and_charts",
      label: "Graphs and charts",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "forecasting",
      label: "Forecasting",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "property_comparison",
      label: "Property comparison",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "portfolio_dashboard",
      label: "Portfolio dashboard",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "advanced_reports",
      label: "Advanced reports",
      values: tier(no, label("Limited"), yes, yes)
    },
    {
      id: "tenant_application_links",
      label: "Tenant application links",
      values: tier(
        label("1 active link"),
        label("10 active"),
        label("Unlimited"),
        label("Unlimited")
      )
    },
    {
      id: "report_branding",
      label: "Report branding",
      values: tier(no, no, no, yes)
    },
    {
      id: "team_access",
      label: "Team access",
      values: tier(no, no, no, label("Included"))
    },
    {
      id: "priority_support",
      label: "Priority support",
      values: tier(
        label("Standard"),
        label("Standard"),
        label("Priority"),
        label("Priority")
      )
    }
  ];
}

export function orderPlansForComparison(plans: SubscriptionPlanRecord[]): SubscriptionPlanRecord[] {
  return PRICING_PLAN_CODES.map((code) => plans.find((p) => p.code === code)).filter(
    (p): p is SubscriptionPlanRecord => Boolean(p)
  );
}
