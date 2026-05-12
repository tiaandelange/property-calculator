import { calculators } from "./calculators";
import { groupCalculators } from "./calculatorHubGroups";
import { HOMEPAGE_ASSET_BASE } from "./homepageAssets";

/**
 * One WebP per calculator slug under `public/assets/homepage/icons/calculators/`.
 */
export const calculatorMegaMenuIconWebpBySlug: Record<string, string> = {
  "transfer-bond-costs": "icon-calculator-transfer-cost.webp",
  "monthly-payment": "icon-calculator-bond-repayment.webp",
  ltv: "icon-calculator-mortgage.webp",
  "square-footage": "icon-calculator-square-footage.webp",
  "cash-flow": "icon-calculator-cash-flow.webp",
  noi: "icon-calculator-noi.webp",
  "operating-expense-ratio": "icon-calculator-operating-expense-ratio.webp",
  "short-term-rental": "icon-calculator-short-term-rental.webp",
  "cash-on-cash-return": "icon-calculator-cash-on-cash-return.webp",
  "cap-rate": "icon-calculator-rental-yield.webp",
  irr: "icon-calculator-investment-return.webp",
  dscr: "icon-calculator-affordability.webp",
  dcf: "icon-calculator-dcf.webp",
  grm: "icon-calculator-grm.webp",
  "rent-to-cost-ratio": "icon-calculator-rent-to-cost-ratio.webp",
  brrrr: "icon-calculator-brrrr.webp",
  "70-rule": "icon-calculator-70-rule.webp",
  "flip-profit": "icon-calculator-flip-profit.webp",
  "wholesale-profit": "icon-calculator-wholesale-profit.webp",
  "rehab-cost": "icon-calculator-rehab-cost.webp"
};

export const calculatorMegaMenuTaglineBySlug: Record<string, string> = {
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
  iconWebpFilename: string;
  iconSrc: string;
  tagline: string;
};

export type CalculatorMegaMenuGroup = {
  title: string;
  items: CalculatorMegaMenuItem[];
};

export function calculatorMegaMenuIconSrcForSlug(slug: string): string {
  const file = calculatorMegaMenuIconWebpBySlug[slug];
  if (!file) {
    return `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-${slug}.webp`;
  }
  return `${HOMEPAGE_ASSET_BASE}/icons/calculators/${file}`;
}

export function getCalculatorMegaMenuGroups(): CalculatorMegaMenuGroup[] {
  return groupCalculators(calculators)
    .filter((g) => g.title !== "Other tools")
    .map((g) => ({
      title: g.title,
      items: g.items.map((c) => {
        const iconWebpFilename =
          calculatorMegaMenuIconWebpBySlug[c.slug] ?? `icon-calculator-${c.slug}.webp`;
        return {
          slug: c.slug,
          name: c.name,
          route: `/calculators/${c.slug}`,
          iconWebpFilename,
          iconSrc: `${HOMEPAGE_ASSET_BASE}/icons/calculators/${iconWebpFilename}`,
          tagline: calculatorMegaMenuTaglineBySlug[c.slug] ?? c.description
        };
      })
    }));
}
