import { calculators } from "./calculators";
import { groupCalculators } from "./calculatorHubGroups";

export const calculatorMegaMenuTaglineBySlug: Record<string, string> = {
  "buy-vs-rent": "Simple buy or rent comparison",
  "transfer-bond-costs": "Duty, fees and cash to register",
  "monthly-payment": "Instalment, interest and amortisation",
  ltv: "Loan size versus property value",
  "square-footage": "Area conversions and rent per foot",
  "cash-flow": "Net cash after vacancy and debt",
  noi: "Income before loan payments",
  "operating-expense-ratio": "Operating costs versus income",
  "short-term-rental": "STR income versus long-term lease",
  "cash-on-cash-return": "Cash profit on equity invested",
  "cap-rate": "Yield on price from net income",
  irr: "Return over time on cash flows",
  dscr: "Income cover for bond payments",
  dcf: "Value from discounted projections",
  grm: "Price divided by gross rent",
  "rent-to-cost-ratio": "Rent versus money in the deal",
  brrrr: "Rehab, rent, then refinance equity",
  "70-rule": "Quick flip offer price rule",
  "flip-profit": "Buy, fix and sell profit picture",
  "wholesale-profit": "Assignment fee and deal spread",
  "rehab-cost": "Scope budget and contingency buffer"
};

export type CalculatorMegaMenuItem = {
  slug: string;
  name: string;
  route: string;
  tagline: string;
};

export type CalculatorMegaMenuGroup = {
  title: string;
  items: CalculatorMegaMenuItem[];
};

export function getCalculatorMegaMenuGroups(): CalculatorMegaMenuGroup[] {
  return groupCalculators(calculators)
    .filter((g) => g.title !== "Other tools")
    .map((g) => ({
      title: g.title,
      items: g.items.map((c) => ({
        slug: c.slug,
        name: c.name,
        route: `/calculators/${c.slug}`,
        tagline: calculatorMegaMenuTaglineBySlug[c.slug] ?? c.description
      }))
    }));
}
