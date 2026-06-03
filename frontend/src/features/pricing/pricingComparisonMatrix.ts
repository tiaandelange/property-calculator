import { STARTER_POST_TRIAL_PRICE_LABEL } from "../../data/pricingPageContent";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import { formatPlanPrice, starterShowsFreeTrial } from "./pricingPlanDisplay";

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

function plansByCode(plans: SubscriptionPlanRecord[]): Partial<Record<PricingPlanCode, SubscriptionPlanRecord>> {
  const map: Partial<Record<PricingPlanCode, SubscriptionPlanRecord>> = {};
  for (const plan of plans) {
    if (PRICING_PLAN_CODES.includes(plan.code as PricingPlanCode)) {
      map[plan.code as PricingPlanCode] = plan;
    }
  }
  return map;
}

function trialCell(plan?: SubscriptionPlanRecord): ComparisonCellValue {
  if (!plan) return no;
  if (starterShowsFreeTrial(plan)) return yes;
  if (plan.trialDays > 0) return yes;
  return no;
}

function reportLimitText(plan?: SubscriptionPlanRecord): string {
  if (!plan) return "—";
  if (plan.includesUnlimitedReports || plan.reportLimit == null) return "Unlimited";
  return `${plan.reportLimit} per month`;
}

function propertyLimitText(plan?: SubscriptionPlanRecord): string {
  if (!plan) return "—";
  if (plan.propertyLimit == null) return "Unlimited";
  return String(plan.propertyLimit);
}

function monthlyPriceCell(plan?: SubscriptionPlanRecord): ComparisonCellValue {
  if (!plan) return label("—");
  if (plan.code === "starter" && plan.monthlyPrice === 0) {
    return label(`FREE, then ${STARTER_POST_TRIAL_PRICE_LABEL}`);
  }
  if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
    return label(`FREE trial, then ${formatPlanPrice(plan.monthlyPrice, plan.currency)}`);
  }
  if (plan.code === "portfolio_pro") {
    return label(`${formatPlanPrice(plan.monthlyPrice, plan.currency)} or contact us`);
  }
  return label(formatPlanPrice(plan.monthlyPrice, plan.currency));
}

function tier(
  starter: ComparisonCellValue,
  investor: ComparisonCellValue,
  portfolio: ComparisonCellValue,
  portfolioPro: ComparisonCellValue
): Record<PricingPlanCode, ComparisonCellValue> {
  return { starter, investor, portfolio, portfolio_pro: portfolioPro };
}

/** Full feature matrix for the pricing comparison table. */
export function buildPricingComparisonRows(plans: SubscriptionPlanRecord[]): ComparisonRow[] {
  const byCode = plansByCode(plans);
  const starter = byCode.starter;
  const investor = byCode.investor;
  const portfolio = byCode.portfolio;
  const portfolioPro = byCode.portfolio_pro;

  const basic = label("Basic");
  const limited = label("Limited");
  const advanced = label("Advanced");

  return [
    {
      id: "monthly_price",
      label: "Monthly price",
      values: {
        starter: monthlyPriceCell(starter),
        investor: monthlyPriceCell(investor),
        portfolio: monthlyPriceCell(portfolio),
        portfolio_pro: monthlyPriceCell(portfolioPro)
      }
    },
    {
      id: "free_trial",
      label: "14-day free trial",
      values: {
        starter: trialCell(starter),
        investor: trialCell(investor),
        portfolio: trialCell(portfolio),
        portfolio_pro: trialCell(portfolioPro)
      }
    },
    {
      id: "property_limit",
      label: "Property limit",
      values: tier(
        label(propertyLimitText(starter)),
        label(propertyLimitText(investor)),
        label(propertyLimitText(portfolio)),
        label(propertyLimitText(portfolioPro))
      )
    },
    {
      id: "investment_report_limit",
      label: "Investment report limit",
      values: tier(
        label(reportLimitText(starter)),
        label(reportLimitText(investor)),
        label(reportLimitText(portfolio)),
        label(reportLimitText(portfolioPro))
      )
    },
    {
      id: "public_calculators",
      label: "Public calculators",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "property_dashboard",
      label: "Property dashboard",
      values: tier(basic, yes, yes, yes)
    },
    {
      id: "portfolio_analytics",
      label: "Portfolio analytics",
      values: tier(basic, yes, advanced, advanced)
    },
    {
      id: "cash_flow_tracking",
      label: "Cash flow tracking",
      values: tier(basic, yes, yes, yes)
    },
    {
      id: "equity_tracking",
      label: "Equity tracking",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "cash_on_cash_roi",
      label: "Cash on Cash ROI",
      values: tier(limited, yes, yes, yes)
    },
    {
      id: "irr_projection",
      label: "IRR / projection metrics",
      values: tier(limited, yes, yes, yes)
    },
    {
      id: "property_type_calculators",
      label: "Property type calculator flows",
      values: tier(no, yes, yes, yes)
    },
    {
      id: "tenant_management",
      label: "Tenant management",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "lease_management",
      label: "Lease management",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "invoice_generation",
      label: "Invoice generation",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "property_statements",
      label: "Property statements",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "tenant_statements",
      label: "Tenant statements",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "recurring_expenses",
      label: "Recurring expenses",
      values: tier(yes, yes, yes, yes)
    },
    {
      id: "pdf_exports",
      label: "PDF report exports",
      values: tier(limited, yes, yes, yes)
    },
    {
      id: "advanced_reports",
      label: "Advanced reports",
      values: tier(no, no, yes, yes)
    },
    {
      id: "branded_pdfs",
      label: "Branded PDFs",
      values: tier(no, no, label("Coming soon"), yes)
    },
    {
      id: "priority_support",
      label: "Priority support",
      values: tier(no, no, no, yes)
    },
    {
      id: "future_team_access",
      label: "Future team access",
      values: tier(no, no, no, label("Coming soon"))
    }
  ];
}

export function orderPlansForComparison(plans: SubscriptionPlanRecord[]): SubscriptionPlanRecord[] {
  return PRICING_PLAN_CODES.map((code) => plans.find((p) => p.code === code)).filter(
    (p): p is SubscriptionPlanRecord => Boolean(p)
  );
}
