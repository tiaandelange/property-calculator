import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Building2,
  Calculator,
  CircleDollarSign,
  Coins,
  Home,
  Hotel,
  KeyRound,
  LineChart,
  Percent,
  PieChart,
  RefreshCw,
  Ruler,
  Scale,
  Target,
  TrendingUp,
  Wallet,
  Wrench,
  type LucideIcon
} from "lucide-react";
import type { IconContainerAccent } from "../components/ui/IconContainer";

export type CalculatorIconConfig = {
  icon: LucideIcon;
  accent: IconContainerAccent;
};

const DEFAULT_CONFIG: CalculatorIconConfig = { icon: Calculator, accent: "primary" };

/** Lucide icon + accent per calculator slug (replaces WebP assets). */
export const calculatorIconBySlug: Record<string, CalculatorIconConfig> = {
  "buy-vs-rent": { icon: KeyRound, accent: "primary" },
  "transfer-bond-costs": { icon: ArrowLeftRight, accent: "info" },
  "monthly-payment": { icon: Calculator, accent: "primary" },
  ltv: { icon: Home, accent: "info" },
  "square-footage": { icon: Ruler, accent: "neutral" },
  "cash-flow": { icon: Wallet, accent: "success" },
  noi: { icon: BarChart3, accent: "info" },
  "operating-expense-ratio": { icon: PieChart, accent: "warning" },
  "short-term-rental": { icon: Hotel, accent: "warning" },
  "cash-on-cash-return": { icon: CircleDollarSign, accent: "success" },
  "cap-rate": { icon: Percent, accent: "success" },
  irr: { icon: TrendingUp, accent: "primary" },
  dscr: { icon: Scale, accent: "warning" },
  dcf: { icon: LineChart, accent: "info" },
  grm: { icon: Building2, accent: "info" },
  "rent-to-cost-ratio": { icon: Percent, accent: "warning" },
  brrrr: { icon: RefreshCw, accent: "primary" },
  "70-rule": { icon: Target, accent: "warning" },
  "flip-profit": { icon: Coins, accent: "success" },
  "wholesale-profit": { icon: Banknote, accent: "info" },
  "rehab-cost": { icon: Wrench, accent: "info" }
};

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
  return calculatorIconBySlug[slug] ?? DEFAULT_CONFIG;
}

/** @deprecated WebP paths removed — use getCalculatorIconConfig(slug) with IconContainer. */
export function getCalculatorIconSrcForSlug(_slug: string): string {
  return "";
}
