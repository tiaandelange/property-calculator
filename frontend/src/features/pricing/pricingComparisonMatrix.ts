import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import { formatPlanPrice, planPriceHeadline } from "./pricingPlanDisplay";

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
  if (!plan || plan.trialDays <= 0) return no;
  return yes;
}

function reportLimitText(plan?: SubscriptionPlanRecord): string {
  if (!plan) return "—";
  if (plan.includesUnlimitedReports || plan.reportLimit == null) return "Unlimited";
  return `${plan.reportLimit} per month`;
}

function propertyLimitText(plan?: SubscriptionPlanRecord): string {
  if (!plan) return "—";
  if (plan.propertyLimit == null) return "Unlimited";
  return `Up to ${plan.propertyLimit} properties`;
}

/** Full feature matrix for the pricing comparison table (20 feature rows + dynamic price/limits). */
export function buildPricingComparisonRows(plans: SubscriptionPlanRecord[]): ComparisonRow[] {
  const byCode = plansByCode(plans);
  const starter = byCode.starter;
  const investor = byCode.investor;
  const portfolio = byCode.portfolio;
  const portfolioPro = byCode.portfolio_pro;

  return [
    {
      id: "monthly_price",
      label: "Monthly price",
      values: {
        starter: label(starter ? planPriceHeadline(starter) : "Free"),
        investor: label(investor ? formatPlanPrice(investor.monthlyPrice, investor.currency) : "R299/month"),
        portfolio: label(portfolio ? formatPlanPrice(portfolio.monthlyPrice, portfolio.currency) : "R599/month"),
        portfolio_pro: label(
          portfolioPro
            ? `${formatPlanPrice(portfolioPro.monthlyPrice, portfolioPro.currency)} or Contact us`
            : "R999/month or Contact us"
        )
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
      id: "analytics_dashboard",
      label: "Property analytics dashboard",
      values: {
        starter: label("Basic"),
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "property_management",
      label: "Property management tools",
      values: {
        starter: label("Basic"),
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "tenant_management",
      label: "Tenant management",
      values: {
        starter: yes,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "lease_management",
      label: "Lease management",
      values: {
        starter: yes,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "invoice_generation",
      label: "Invoice generation",
      values: {
        starter: yes,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "property_statements",
      label: "Property statements",
      values: {
        starter: yes,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "tenant_statements",
      label: "Tenant statements",
      values: {
        starter: yes,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "recurring_expenses",
      label: "Recurring expenses",
      values: {
        starter: yes,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "pdf_exports",
      label: "PDF exports",
      values: {
        starter: label("Limited"),
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "investment_calculators",
      label: "Investment calculators",
      values: {
        starter: no,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "investment_reports",
      label: "Investment reports",
      values: {
        starter: label("3 per month"),
        investor: label("10 per month"),
        portfolio: label("Unlimited"),
        portfolio_pro: label("Unlimited")
      }
    },
    {
      id: "report_limit",
      label: "Report limit",
      values: {
        starter: label(reportLimitText(starter)),
        investor: label(reportLimitText(investor)),
        portfolio: label(reportLimitText(portfolio)),
        portfolio_pro: label(reportLimitText(portfolioPro))
      }
    },
    {
      id: "property_limit",
      label: "Property / unit limit",
      values: {
        starter: label(propertyLimitText(starter)),
        investor: label(propertyLimitText(investor)),
        portfolio: label(propertyLimitText(portfolio)),
        portfolio_pro: label(propertyLimitText(portfolioPro))
      }
    },
    {
      id: "multi_property_comparison",
      label: "Multi-property comparison",
      values: {
        starter: no,
        investor: yes,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "advanced_portfolio_reports",
      label: "Advanced portfolio reports",
      values: {
        starter: no,
        investor: no,
        portfolio: yes,
        portfolio_pro: yes
      }
    },
    {
      id: "branded_pdf_reports",
      label: "Branded PDF reports",
      values: {
        starter: no,
        investor: no,
        portfolio: label("Coming soon"),
        portfolio_pro: yes
      }
    },
    {
      id: "priority_support",
      label: "Priority support",
      values: {
        starter: no,
        investor: no,
        portfolio: no,
        portfolio_pro: yes
      }
    },
    {
      id: "future_team_access",
      label: "Future team access",
      values: {
        starter: no,
        investor: no,
        portfolio: no,
        portfolio_pro: label("Coming soon")
      }
    }
  ];
}

export function orderPlansForComparison(plans: SubscriptionPlanRecord[]): SubscriptionPlanRecord[] {
  return PRICING_PLAN_CODES.map((code) => plans.find((p) => p.code === code)).filter(
    (p): p is SubscriptionPlanRecord => Boolean(p)
  );
}
