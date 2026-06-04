import { calculators, type CalculatorDef } from "./calculators";
import type { IconName } from "../components/icons/iconRegistry";

export type CalculatorHubCategoryId =
  | "all"
  | "popular"
  | "purchase-financing"
  | "income-operations"
  | "investment-analysis"
  | "taxes-costs"
  | "other";

export type CalculatorHubDirectoryItem =
  | { kind: "tool"; id: string; slug: string; name: string; description: string }
  | { kind: "soon"; id: string; name: string; description: string };

export type CalculatorHubDirectoryGroup = {
  categoryId: Exclude<CalculatorHubCategoryId, "all">;
  title: string;
  items: CalculatorHubDirectoryItem[];
};

export const CALCULATOR_HUB_CATEGORIES: Array<{
  id: CalculatorHubCategoryId;
  label: string;
  icon: IconName;
}> = [
  { id: "all", label: "All", icon: "calculators" },
  { id: "popular", label: "Popular", icon: "star" },
  { id: "purchase-financing", label: "Purchase & Financing", icon: "property" },
  { id: "income-operations", label: "Income & Operations", icon: "wallet" },
  { id: "investment-analysis", label: "Investment Analysis", icon: "reports" },
  { id: "taxes-costs", label: "Taxes & Costs", icon: "expense" },
  { id: "other", label: "Other", icon: "tools" }
];

const bySlug = new Map(calculators.map((c) => [c.slug, c]));

function tool(
  id: string,
  slug: string,
  name: string,
  description: string
): CalculatorHubDirectoryItem {
  const c = bySlug.get(slug);
  if (!c) {
    return { kind: "soon", id, name, description };
  }
  return { kind: "tool", id, slug, name, description };
}

function soon(id: string, name: string, description: string): CalculatorHubDirectoryItem {
  return { kind: "soon", id, name, description };
}

/** Display metadata for the /calculators directory (frontend only). */
export const calculatorHubDirectoryGroups: CalculatorHubDirectoryGroup[] = [
  {
    categoryId: "purchase-financing",
    title: "Purchase & Financing",
    items: [
      tool(
        "transfer-bond-costs",
        "transfer-bond-costs",
        "Transfer & Bond Costs (South Africa)",
        "Calculate duties, fees and total cash to register."
      ),
      tool(
        "buy-vs-rent",
        "buy-vs-rent",
        "Buy vs Rent Calculator",
        "Compare the true long-term costs of buying vs renting."
      ),
      tool(
        "monthly-payment",
        "monthly-payment",
        "Monthly Bond Payment",
        "See your instalment, interest and amortisation breakdown."
      ),
      tool("ltv", "ltv", "Loan-to-Value (LTV)", "Calculate loan size based on property value."),
      tool(
        "square-footage",
        "square-footage",
        "Square Footage / Area",
        "Convert areas and calculate rent per square foot."
      )
    ]
  },
  {
    categoryId: "income-operations",
    title: "Income & Operations",
    items: [
      tool("cash-flow", "cash-flow", "Cash Flow", "Calculate net income after vacancy and debt."),
      tool(
        "cash-on-cash-return",
        "cash-on-cash-return",
        "Cash-on-Cash ROI",
        "Measure cash return on your total investment."
      ),
      tool(
        "operating-expense-ratio",
        "operating-expense-ratio",
        "Expense Ratio",
        "See what percentage of income goes to expenses."
      )
    ]
  },
  {
    categoryId: "investment-analysis",
    title: "Investment Analysis",
    items: [
      tool("rental-yield", "cap-rate", "Rental Yield", "Net operating income versus property value."),
      soon("capital-growth", "Capital Growth", "Model expected appreciation over your hold period."),
      tool("total-return", "irr", "Total Return", "Internal rate of return over your investment horizon."),
      soon(
        "break-even-occupancy",
        "Break-even Occupancy",
        "Find the occupancy rate needed to cover costs."
      )
    ]
  },
  {
    categoryId: "taxes-costs",
    title: "Taxes & Costs",
    items: [
      soon("transfer-duty", "Transfer Duty", "Estimate transfer duty on a property purchase."),
      soon("monthly-ownership", "Monthly Ownership Costs", "Rates, levies, insurance and maintenance."),
      soon("selling-costs", "Selling Costs", "Agent commission, compliance and closing fees."),
      soon("taxable-rental-income", "Taxable Rental Income", "Estimate tax on rental profit.")
    ]
  },
  {
    categoryId: "other",
    title: "Other",
    items: [
      tool("noi", "noi", "Net Operating Income (NOI)", "Income after operating expenses, before debt."),
      tool("dscr", "dscr", "Debt Service Coverage (DSCR)", "Can rental income cover the bond payment?"),
      tool("brrrr", "brrrr", "BRRRR / Refinance", "Buy, rehab, rent, refinance and repeat."),
      tool("short-term-rental", "short-term-rental", "Short-term Rental", "Nightly rate, occupancy and platform fees."),
      tool("70-rule", "70-rule", "70% Rule", "Quick flip maximum offer price check."),
      tool("flip-profit", "flip-profit", "Flip Profit", "Purchase, rehab, sale and profit after costs."),
      tool("wholesale-profit", "wholesale-profit", "Wholesale Profit", "Assignment fee and spread analysis."),
      tool("rehab-cost", "rehab-cost", "Rehab Cost", "Line-item renovation budget total."),
      tool("rent-to-cost", "rent-to-cost-ratio", "Rent-to-Cost Ratio", "Monthly rent versus total project cost."),
      tool("grm", "grm", "Gross Rent Multiplier", "Price divided by gross annual rent."),
      tool("dcf", "dcf", "Discounted Cash Flow", "Present value of future property cash flows.")
    ]
  }
];

export function resolveCalculatorHubTool(slug: string): CalculatorDef | undefined {
  return bySlug.get(slug);
}

/** Slugs shown under the Popular category filter (display order). */
export const CALCULATOR_HUB_POPULAR_SLUGS = [
  "monthly-payment",
  "transfer-bond-costs",
  "cash-flow",
  "cash-on-cash-return",
  "buy-vs-rent"
] as const;

function findDirectoryItemBySlug(slug: string): CalculatorHubDirectoryItem | undefined {
  for (const group of calculatorHubDirectoryGroups) {
    const item = group.items.find((entry) => entry.kind === "tool" && entry.slug === slug);
    if (item) return item;
  }
  return undefined;
}

/** Single “Popular” group for the hub directory when that filter is active. */
export function calculatorHubPopularGroup(): CalculatorHubDirectoryGroup {
  const items = CALCULATOR_HUB_POPULAR_SLUGS.flatMap((slug) => {
    const item = findDirectoryItemBySlug(slug);
    return item ? [item] : [];
  });
  return {
    categoryId: "purchase-financing",
    title: "Popular",
    items
  };
}
