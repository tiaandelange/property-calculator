import { calculators, type CalculatorDef } from "./calculators";

export type PublicCalculatorLandingItem =
  | { kind: "tool"; id: string; slug: string; name: string; description: string }
  | { kind: "soon"; id: string; name: string; description: string };

export type PublicCalculatorLandingGroup = {
  title: string;
  items: PublicCalculatorLandingItem[];
};

const bySlug = new Map(calculators.map((c) => [c.slug, c]));

function tool(id: string, slug: string, name?: string, description?: string): PublicCalculatorLandingItem {
  const c = bySlug.get(slug);
  if (!c) {
    return { kind: "soon", id, name: name ?? slug, description: description ?? "Coming soon." };
  }
  return {
    kind: "tool",
    id,
    slug,
    name: name ?? c.name,
    description: description ?? c.description
  };
}

function soon(id: string, name: string, description: string): PublicCalculatorLandingItem {
  return { kind: "soon", id, name, description };
}

/** Public /calculators landing page groupings (marketing labels). */
export const publicCalculatorLandingGroups: PublicCalculatorLandingGroup[] = [
  {
    title: "Finance & Loan",
    items: [
      tool("mortgage-payment", "monthly-payment", "Mortgage / Bond Payment", "Estimate monthly bond repayments."),
      tool("interest-cost", "monthly-payment", "Interest Cost", "See total interest and repayment over the loan term."),
      tool("amortisation", "monthly-payment", "Amortisation", "Principal, interest and balance over time."),
      tool("refinance", "brrrr", "Refinance", "Compare refinance LTV and cash left in the deal."),
      tool("ltv", "ltv", "Loan-to-Value", "Loan amount versus property value.")
    ]
  },
  {
    title: "Investment Returns",
    items: [
      tool("rental-yield", "cap-rate", "Rental Yield", "Net operating income versus property value."),
      tool("cash-flow", "cash-flow", "Cash Flow", "Income minus expenses and loan payment."),
      tool("cash-on-cash", "cash-on-cash-return", "Cash-on-Cash ROI", "Annual cash flow versus cash invested."),
      tool("cap-rate", "cap-rate", "Cap Rate", "NOI yield independent of financing."),
      tool("roi", "cash-on-cash-return", "ROI", "Return on cash invested in the property."),
      tool("irr", "irr", "IRR", "Internal rate of return over your hold period.")
    ]
  },
  {
    title: "Buying Decisions",
    items: [
      soon("affordability", "Affordability", "Estimate what you can afford — coming soon."),
      tool("buy-vs-rent", "buy-vs-rent", "Buy vs Rent", "Compare renting versus buying over time."),
      tool(
        "transfer-costs",
        "transfer-bond-costs",
        "Transfer / Closing Costs",
        "Estimate upfront purchase and registration costs."
      )
    ]
  },
  {
    title: "Rental Models",
    items: [
      tool("vacancy-impact", "cash-flow", "Vacancy Impact", "Model vacancy rate against net cash flow."),
      tool("expense-ratio", "operating-expense-ratio", "Expense Ratio", "Operating expenses as a percentage of income."),
      tool("airbnb-income", "short-term-rental", "Airbnb Income", "Nightly rate, occupancy and platform fees."),
      soon("multi-unit-income", "Multi-Unit Income", "Per-unit rent and occupancy — coming soon.")
    ]
  }
];

export function resolvePublicLandingCalculator(slug: string): CalculatorDef | undefined {
  return bySlug.get(slug);
}
