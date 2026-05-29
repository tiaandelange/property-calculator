import type { IconContainerAccent } from "../components/icons/IconContainer";
import { getCalculatorLucideIcon } from "../components/icons/iconRegistry";
import type { LucideIcon } from "lucide-react";

export type CalculatorIconConfig = {
  icon: LucideIcon;
  accent: IconContainerAccent;
};

const DEFAULT_CONFIG: CalculatorIconConfig = { icon: getCalculatorLucideIcon(""), accent: "primary" };

const CALCULATOR_ACCENTS: Record<string, IconContainerAccent> = {
  "buy-vs-rent": "primary",
  "transfer-bond-costs": "info",
  "monthly-payment": "primary",
  ltv: "info",
  "square-footage": "neutral",
  "cash-flow": "success",
  noi: "info",
  "operating-expense-ratio": "warning",
  "short-term-rental": "warning",
  "cash-on-cash-return": "success",
  "cap-rate": "success",
  irr: "primary",
  dscr: "warning",
  dcf: "info",
  grm: "info",
  "rent-to-cost-ratio": "warning",
  brrrr: "primary",
  "70-rule": "warning",
  "flip-profit": "success",
  "wholesale-profit": "info",
  "rehab-cost": "info"
};

/** Lucide icon + accent per calculator slug (replaces WebP assets). */
export const calculatorIconBySlug: Record<string, CalculatorIconConfig> = Object.fromEntries(
  Object.entries(CALCULATOR_ACCENTS).map(([slug, accent]) => [
    slug,
    { icon: getCalculatorLucideIcon(slug), accent }
  ])
) as Record<string, CalculatorIconConfig>;

/** Homepage featured calculator keys → slug (for legacy icon key lookups). */
export const calculatorSlugToIconKey: Record<string, string> = {
  "monthly-payment": "bondRepayment",
  ltv: "mortgage",
  "transfer-bond-costs": "transferCost",
  "cash-flow": "affordability",
  noi: "rentalYield",
  "cap-rate": "rentalYield",
  "rent-to-cost-ratio": "rentalYield",
  "cash-on-cash-return": "investmentReturn",
  dscr: "affordability",
  irr: "investmentReturn",
  dcf: "investmentReturn",
  brrrr: "investmentReturn",
  "short-term-rental": "rentalYield",
  "70-rule": "investmentReturn",
  "flip-profit": "investmentReturn",
  "square-footage": "mortgage"
};

export function getCalculatorIconConfig(slug: string): CalculatorIconConfig {
  return calculatorIconBySlug[slug] ?? { icon: getCalculatorLucideIcon(slug), accent: "primary" };
}

/** @deprecated WebP paths removed — use getCalculatorIconConfig(slug) with IconContainer. */
export function getCalculatorIconSrcForSlug(_slug: string): string {
  return "";
}
