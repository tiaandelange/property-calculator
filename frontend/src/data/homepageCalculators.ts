import { calculators } from "./calculators";
import { getCalculatorIconSrcForSlug, homepageCalculatorIcons } from "./homepageAssets";

/**
 * Central registry for homepage calculator links (quick launcher + popular band).
 * Routes match `App.tsx`: `/calculators/:slug` → `CalculatorPage`, which resolves the
 * template from `calculators` by `slug`. `templateKey` is therefore the same as that slug.
 */

const slugSet = new Set(calculators.map((c) => c.slug));

export type HomepageCalculatorCategory =
  | "borrowing"
  | "affordability"
  | "yield"
  | "purchase"
  | "debt-service"
  | "returns"
  | "popular-picks";

export type HomepageCalculatorEntry = {
  id: string;
  title: string;
  shortDescription: string;
  /** Resolved URL; use `calculatorRouteForSlug` if you only have a `templateKey`. */
  route: string;
  /** Public WebP under `/assets/homepage/icons/calculators/`. */
  icon: string;
  /** Dynamic segment for `/calculators/:slug` — must exist in `calculators` or route falls back to hub. */
  templateKey: string;
  category: HomepageCalculatorCategory;
};

function routeForTemplate(templateKey: string): string {
  if (!slugSet.has(templateKey)) {
    // TODO: Add a `CalculatorDef` with slug `${templateKey}` in calculators.ts, then this can link to `/calculators/${templateKey}`.
    return "/calculators";
  }
  return `/calculators/${templateKey}`;
}

function entry(partial: Omit<HomepageCalculatorEntry, "route">): HomepageCalculatorEntry {
  return { ...partial, route: routeForTemplate(partial.templateKey) };
}

/**
 * Six featured homepage calculators (quick launcher + first tiles in the popular band).
 * Icon filenames per design: icon-calculator-*.webp (paths via `homepageCalculatorIcons`).
 */
/**
 * Short label for compact hero launcher chips (drops trailing “Calculator”).
 * Prefer `title` from `homepageCalculators` — do not duplicate route strings here.
 */
export function homepageCalculatorLauncherShortTitle(title: string): string {
  return title.replace(/\s+Calculator$/i, "").trim();
}

/** First five homepage calculators for the hero floating launcher (same order as `homepageCalculators`). */
export function getHomepageHeroLauncherCalculators(): readonly HomepageCalculatorEntry[] {
  return homepageCalculators.slice(0, 5);
}

export const homepageCalculators: readonly HomepageCalculatorEntry[] = [
  entry({
    id: "mortgage-calculator",
    title: "Mortgage Calculator",
    shortDescription: "Loan-to-value and equity — structure your bond against property value.",
    icon: homepageCalculatorIcons.mortgage,
    templateKey: "ltv",
    category: "borrowing"
  }),
  entry({
    id: "affordability-calculator",
    title: "Affordability Calculator",
    shortDescription: "Debt-service coverage — see if income supports the loan under stress.",
    icon: homepageCalculatorIcons.affordability,
    templateKey: "dscr",
    category: "affordability"
  }),
  entry({
    id: "rental-yield-calculator",
    title: "Rental Yield Calculator",
    shortDescription: "Cap rate from NOI and value — a fast read on rental yield.",
    icon: homepageCalculatorIcons.rentalYield,
    templateKey: "cap-rate",
    category: "yield"
  }),
  entry({
    id: "transfer-cost-calculator",
    title: "Transfer Cost Calculator",
    shortDescription: "Transfer duty, bond registration and typical upfront purchase costs.",
    icon: homepageCalculatorIcons.transferCost,
    templateKey: "transfer-bond-costs",
    category: "purchase"
  }),
  entry({
    id: "bond-repayment-calculator",
    title: "Bond Repayment Calculator",
    shortDescription: "Monthly instalment, total interest and amortisation with extra payments.",
    icon: homepageCalculatorIcons.bondRepayment,
    templateKey: "monthly-payment",
    category: "debt-service"
  }),
  entry({
    id: "investment-return-calculator",
    title: "Investment Return Calculator",
    shortDescription: "IRR from cash flows and exit — compare scenarios over your hold period.",
    icon: homepageCalculatorIcons.investmentReturn,
    templateKey: "irr",
    category: "returns"
  })
];

/** Extra slugs appended after `homepageCalculators` for the eight-tile “Popular calculators” row. */
const HOMEPAGE_POPULAR_EXTRA_SLUGS = ["cash-flow", "cash-on-cash-return"] as const;

function entryFromCalculatorSlug(
  slug: string,
  category: HomepageCalculatorCategory = "popular-picks"
): HomepageCalculatorEntry | null {
  const c = calculators.find((x) => x.slug === slug);
  if (!c) {
    // TODO: Register slug in calculators.ts — until then this card is omitted from the homepage band.
    return null;
  }
  return {
    id: `homepage-${slug}`,
    title: c.name,
    shortDescription: c.description,
    route: routeForTemplate(slug),
    icon: getCalculatorIconSrcForSlug(slug),
    templateKey: slug,
    category
  };
}

/** Eight (or fewer) cards for the homepage “Popular calculators” grid — single source for links. */
export function getHomepagePopularCalculatorCards(): readonly HomepageCalculatorEntry[] {
  const primary = [...homepageCalculators];
  const extras = HOMEPAGE_POPULAR_EXTRA_SLUGS.map((s) => entryFromCalculatorSlug(s)).filter(
    (x): x is HomepageCalculatorEntry => x != null
  );
  return [...primary, ...extras];
}

export function calculatorRouteForSlug(slug: string): string {
  return routeForTemplate(slug);
}
