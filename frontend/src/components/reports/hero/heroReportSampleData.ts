/** Static decorative sample data for the public Reports hero — not user data. */

export const HERO_REPORT_FRONT = {
  title: "Portfolio Report",
  period: "Q2 2026",
  portfolioCount: "4 properties",
  prepared: "May 2026",
  metrics: [
    { label: "Portfolio Value", value: "R 8.45M" },
    { label: "Monthly Cash Flow", value: "R 41,200" },
    { label: "Occupancy", value: "96.2%" },
    { label: "Average Yield", value: "8.7%" }
  ] as const,
  properties: [
    { name: "Coastal Duplex", value: "R 2.85M", cashFlow: "R 1,950" },
    { name: "Greenwood Estate", value: "R 3.10M", cashFlow: "R 6,800" },
    { name: "Heritage Heights", value: "R 2.50M", cashFlow: "R 3,200" }
  ] as const,
  footer: "Prepared by Proplytic • Investor-ready report"
} as const;

export const HERO_REPORT_CASH_FLOW = {
  title: "Cash Flow Breakdown",
  rows: [
    { label: "Rental Income", value: "R 28,000", tone: "pos" as const },
    { label: "Vacancy Allowance", value: "-R 1,400", tone: "neg" as const },
    { label: "Operating Expenses", value: "-R 6,850", tone: "neg" as const },
    { label: "Bond Payment", value: "-R 17,800", tone: "neg" as const },
    { label: "Net Cash Flow", value: "R 1,950", tone: "total" as const }
  ] as const,
  donut: [
    { label: "Income", pct: 62, color: "#7c3aed" },
    { label: "Expenses", pct: 24, color: "#94a3b8" },
    { label: "Debt", pct: 14, color: "#cbd5e1" }
  ] as const
} as const;

export const HERO_REPORT_PERFORMANCE = {
  title: "Property Performance",
  bars: [
    { label: "Coastal", pct: 68 },
    { label: "Green", pct: 88 },
    { label: "Herit.", pct: 54 }
  ] as const,
  metrics: [
    { label: "Avg. Cap Rate", value: "7.4%" },
    { label: "CoC ROI", value: "11.2%" }
  ] as const,
  notes: [
    "Occupancy stable across portfolio.",
    "Greenwood leads cash flow contribution.",
    "Heritage Heights renovation complete Q1."
  ] as const
} as const;
