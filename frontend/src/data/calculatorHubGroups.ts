import type { CalculatorDef } from "./calculators";

/** Group calculators for the hub and rail submenu (British English labels). */
export const calculatorHubGroups: { title: string; match: (c: CalculatorDef) => boolean }[] = [
  {
    title: "Purchase & financing",
    match: (c) =>
      ["buy-vs-rent", "transfer-bond-costs", "monthly-payment", "ltv", "square-footage"].includes(c.slug)
  },
  {
    title: "Income & operations",
    match: (c) =>
      [
        "cash-flow",
        "noi",
        "operating-expense-ratio",
        "short-term-rental",
        "cash-on-cash-return"
      ].includes(c.slug)
  },
  {
    title: "Returns & valuation",
    match: (c) =>
      ["cap-rate", "irr", "dscr", "dcf", "grm", "rent-to-cost-ratio"].includes(c.slug)
  },
  {
    title: "Strategies & projects",
    match: (c) =>
      ["brrrr", "70-rule", "flip-profit", "wholesale-profit", "rehab-cost"].includes(c.slug)
  }
];

export function groupCalculators(calculators: CalculatorDef[]) {
  const used = new Set<string>();
  const groups: { title: string; items: CalculatorDef[] }[] = [];

  for (const g of calculatorHubGroups) {
    const items = calculators.filter((c) => {
      if (!g.match(c) || used.has(c.slug)) return false;
      used.add(c.slug);
      return true;
    });
    if (items.length) groups.push({ title: g.title, items });
  }

  const rest = calculators.filter((c) => !used.has(c.slug));
  if (rest.length) {
    groups.push({ title: "Other tools", items: rest });
  }

  return groups;
}
