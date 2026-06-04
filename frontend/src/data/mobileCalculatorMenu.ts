import { calculators } from "./calculators";

export type MobileFeaturedCalculatorItem = {
  slug: string;
  name: string;
  route: string;
};

export type MobileFeaturedCalculatorGroup = {
  title: string;
  items: MobileFeaturedCalculatorItem[];
};

const MOBILE_MENU_DISPLAY_NAMES: Record<string, string> = {
  "transfer-bond-costs": "Transfer & Bond Costs",
  "buy-vs-rent": "Buy vs Rent",
  "monthly-payment": "Monthly Bond Payment",
  ltv: "Loan-to-Value",
  "cash-flow": "Cash Flow",
  "cash-on-cash-return": "Cash-on-Cash ROI"
};

const MOBILE_MENU_FEATURED_GROUPS: { title: string; slugs: readonly string[] }[] = [
  {
    title: "Purchase & Financing",
    slugs: ["transfer-bond-costs", "buy-vs-rent", "monthly-payment", "ltv"]
  },
  {
    title: "Income & Operations",
    slugs: ["cash-flow", "cash-on-cash-return"]
  }
];

/** Featured calculators for the mobile nav accordion (full list lives on /calculators). */
export function getMobileFeaturedCalculatorGroups(): MobileFeaturedCalculatorGroup[] {
  const bySlug = new Map(calculators.map((c) => [c.slug, c]));

  return MOBILE_MENU_FEATURED_GROUPS.map((group) => ({
    title: group.title,
    items: group.slugs
      .map((slug) => {
        const calc = bySlug.get(slug);
        if (!calc) return null;
        return {
          slug,
          name: MOBILE_MENU_DISPLAY_NAMES[slug] ?? calc.name,
          route: `/calculators/${slug}`
        };
      })
      .filter((item): item is MobileFeaturedCalculatorItem => item != null)
  }));
}
