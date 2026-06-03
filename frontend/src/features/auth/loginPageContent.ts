import type { IconName } from "../../components/icons/iconRegistry";

export type LoginFeatureRow = {
  icon: IconName;
  title: string;
  description: string;
};

export const LOGIN_BRAND_FEATURES: LoginFeatureRow[] = [
  {
    icon: "portfolio",
    title: "Portfolio analytics",
    description: "Track cash flow, yield, equity and IRR."
  },
  {
    icon: "leases",
    title: "Core rental admin",
    description: "Leases, tenants, invoices and expenses."
  },
  {
    icon: "reports",
    title: "Investor-ready reports",
    description: "Professional PDF reports in seconds."
  },
  {
    icon: "calculators",
    title: "Powerful calculators",
    description: "Property-specific calculators that work."
  }
];

export const LOGIN_PREVIEW_METRICS = [
  { label: "Total Equity", value: "R 4.82M" },
  { label: "Net Cash Flow", value: "R 41,200" },
  { label: "Portfolio Yield", value: "9.4%" }
] as const;

export const LOGIN_PREVIEW_PROPERTIES = [
  { name: "Oak Street Duplex", value: "R 12,400" },
  { name: "Riverside Flat", value: "R 8,900" },
  { name: "Parkview Unit 3", value: "R 6,200" }
] as const;
