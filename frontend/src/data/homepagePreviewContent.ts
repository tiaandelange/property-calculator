/** Static UI mock data for homepage product previews (no API). */

export type PreviewMetric = {
  label: string;
  value: string;
  change?: string;
  changeTone?: "up" | "down" | "neutral";
  highlight?: boolean;
  icon: string;
};

export const homepagePreviewPortfolio = {
  moduleLabel: "Portfolio analytics",
  crumbs: ["Portfolio", "Dashboard"],
  chips: [{ label: "6 properties" }, { label: "Mar 2026", muted: true }],
  metrics: [
    { label: "Total Equity", value: "R 4.82M", change: "+R 318k YoY", changeTone: "up", highlight: true, icon: "portfolio" },
    { label: "Net Cash Flow", value: "R 41,200", change: "+8.2% MoM", changeTone: "up", icon: "wallet" },
    { label: "Yield", value: "9.4%", change: "Gross weighted", changeTone: "neutral", icon: "percent" },
    { label: "Occupancy", value: "94%", change: "17 / 18 let", changeTone: "neutral", icon: "leases" }
  ] as PreviewMetric[],
  chart: {
    title: "Net cash flow · 12 months",
    meta: "After opex & debt",
    summaryValue: "R 41,200 net cash flow",
    summaryChange: "+8.2% vs last month",
    values: [28, 34, 31, 38, 36, 42, 40, 45, 43, 48, 46, 52] as const,
    months: ["A", "M", "J", "J", "A", "S", "O", "N", "D", "J", "F", "M"] as const
  },
  properties: [
    { name: "Riverside duplex", suburb: "Observatory", cashFlow: "R 8,400", yield: "11.2%", status: "Let" },
    { name: "Oak Street flat", suburb: "Gardens", cashFlow: "R 6,100", yield: "9.8%", status: "Let" },
    { name: "Campus View #4", suburb: "Rondebosch", cashFlow: "R 4,950", yield: "8.6%", status: "Let" }
  ]
} as const;

export const homepagePreviewProperty = {
  moduleLabel: "Property overview",
  crumbs: ["Properties", "Riverside duplex"],
  chips: [{ label: "Residential" }, { label: "Active lease", muted: true }],
  headline: "Riverside duplex",
  address: "12 River Lane · Observatory · Cape Town",
  metrics: [
    { label: "Monthly cash flow", value: "R 8,420", change: "+R 640 vs budget", changeTone: "up", icon: "wallet" },
    { label: "Equity", value: "R 1.24M", change: "68% LTV", changeTone: "neutral", icon: "portfolio" },
    { label: "Gross yield", value: "11.2%", change: "On purchase R 1.85M", changeTone: "neutral", icon: "percent" },
    { label: "Cap rate", value: "7.9%", change: "At current rent", changeTone: "neutral", icon: "activity" }
  ] as PreviewMetric[],
  lease: {
    tenant: "Thandi Mbeki",
    rent: "R 14,500 / month",
    term: "1 Apr 2025 – 31 Mar 2027",
    status: "Active"
  },
  expenses: [
    { label: "Bond repayment", amount: "R 9,840" },
    { label: "Rates & levies", amount: "R 2,180" },
    { label: "Insurance", amount: "R 620" }
  ],
  bondVsIncome: {
    title: "Bond payment vs rental income",
    meta: "Riverside duplex · illustrative",
    years: ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"] as const,
    /** Scaled chart units — bond declines, income rises over time */
    bond: [98, 90, 82, 74, 66, 58] as const,
    income: [118, 124, 130, 136, 142, 148] as const,
    bondLabel: "Bond",
    incomeLabel: "Income"
  }
} as const;

export const homepagePreviewStatement = {
  moduleLabel: "Statements",
  crumbs: ["Riverside duplex", "Statement"],
  chips: [{ label: "Mar 2026" }, { label: "Tenant view", muted: true }],
  tenant: "Thandi Mbeki",
  period: "1 Mar – 31 Mar 2026",
  opening: "R 0.00",
  rows: [
    { date: "01 Mar", type: "Invoice", description: "Rent · INV-2026-0312", debit: "R 14,500", credit: "", balance: "R 14,500" },
    { date: "05 Mar", type: "Payment", description: "EFT · Capitec", debit: "", credit: "R 14,500", balance: "R 0.00" },
    { date: "18 Mar", type: "Expense", description: "Plumbing repair", debit: "R 850", credit: "", balance: "R 850" }
  ],
  closing: "R 850.00 due"
} as const;

export const homepagePreviewInvoice = {
  moduleLabel: "Invoices",
  crumbs: ["Riverside duplex", "Invoices"],
  chips: [{ label: "Mar 2026" }],
  document: {
    number: "INV-2026-0312",
    status: "Paid",
    issued: "1 Mar 2026",
    due: "7 Mar 2026",
    tenant: "Thandi Mbeki",
    property: "Riverside duplex · Unit A"
  },
  lines: [
    { description: "Monthly rent — March 2026", qty: "1", amount: "R 14,500.00" },
    { description: "Parking bay", qty: "1", amount: "R 450.00" }
  ],
  subtotal: "R 14,950.00",
  total: "R 14,950.00",
  list: [
    { number: "INV-2026-0312", tenant: "Thandi Mbeki", amount: "R 14,950", status: "Paid" },
    { number: "INV-2026-0288", tenant: "James Naidoo", amount: "R 11,200", status: "Due 4 Apr" },
    { number: "INV-2026-0241", tenant: "Sarah Pillay", amount: "R 9,600", status: "Overdue" }
  ]
} as const;

export const homepagePreviewCalculator = {
  moduleLabel: "Bond calculator",
  crumbs: ["Calculators", "Monthly bond payment"],
  title: "Monthly bond payment",
  inputs: [
    { label: "Purchase price", value: "R 1,850,000" },
    { label: "Deposit (20%)", value: "R 370,000" },
    { label: "Interest rate", value: "11.25% p.a." },
    { label: "Term", value: "20 years" }
  ],
  result: {
    label: "Estimated monthly payment",
    value: "R 19,420",
    note: "Principal & interest · excludes fees"
  },
  breakdown: [
    { label: "Loan amount", value: "R 1.48M" },
    { label: "Total interest", value: "R 1.18M" },
    { label: "Total cost", value: "R 2.66M" }
  ],
  chart: { values: [42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64] as const }
} as const;

export const homepagePreviewReport = {
  moduleLabel: "Investment report",
  disclaimer: "Sample export · illustrative data",
  headerTitle: "Property investment report",
  propertyLine: "Riverside duplex · Observatory",
  generated: "Generated 3 Jun 2026",
  metrics: [
    { label: "IRR (10yr)", value: "14.2%" },
    { label: "Cash on cash", value: "11.8%" },
    { label: "Cap rate", value: "7.6%" },
    { label: "Monthly cash flow", value: "R 18,400" }
  ],
  rules: [
    { label: "2% rule", value: "Pass · R 37k/mo benchmark" },
    { label: "50% rule", value: "48% opex ratio" }
  ],
  table: {
    caption: "Projected vs actual (excerpt)",
    headers: ["Period", "Income", "Expenses", "Net"],
    rows: [
      ["Y1 projected", "R 302,400", "R 198,200", "R 104,200"],
      ["Y1 actual", "R 296,100", "R 201,450", "R 94,650"],
      ["Y5 projected", "R 358,800", "R 224,600", "R 134,200"]
    ]
  },
  chartCaption: "Net cash flow by year",
  chartBars: [38, 52, 48, 61, 58, 72, 68, 78, 74, 82] as const,
  sections: ["Summary", "Projections", "Actuals", "Charts", "Lease"] as const
} as const;

export const homepagePreviewManagement = {
  lease: {
    moduleLabel: "Leases",
    property: "Riverside duplex",
    tenant: "Thandi Mbeki",
    rent: "R 14,500 / month",
    deposit: "R 29,000",
    start: "1 Apr 2025",
    end: "31 Mar 2027",
    status: "Active"
  }
} as const;

export const homepageReportsPreviewMock = {
  disclaimer: homepagePreviewReport.disclaimer,
  headerTitle: homepagePreviewReport.headerTitle,
  propertyLine: homepagePreviewReport.propertyLine,
  metrics: homepagePreviewReport.metrics,
  table: homepagePreviewReport.table,
  chartCaption: homepagePreviewReport.chartCaption,
  chartBars: homepagePreviewReport.chartBars
} as const;

/** Single-property projection mock (Riverside duplex) — mirrors portfolio dashboard Y1…Y30 table + summary chart */
export const homepageHeroProjectionPreview = {
  propertyName: "Riverside duplex",
  years: [1, 2, 5, 10, 15, 20, 30] as const,
  metrics: [
    {
      key: "equity",
      label: "Equity",
      format: "zar" as const,
      values: [1_240_000, 1_318_000, 1_582_000, 2_048_000, 2_615_000, 3_342_000, 5_380_000]
    },
    {
      key: "cashFlow",
      label: "Cash flow",
      format: "zar" as const,
      values: [101_040, 108_200, 132_400, 178_600, 228_900, 294_500, 512_800]
    },
    {
      key: "income",
      label: "Income",
      format: "zar" as const,
      values: [174_000, 182_700, 210_400, 268_200, 342_500, 438_600, 712_400]
    },
    {
      key: "expenses",
      label: "Expenses",
      format: "zar" as const,
      values: [72_960, 74_500, 78_000, 89_600, 113_600, 144_100, 199_600]
    },
    {
      key: "cocRoi",
      label: "CoC ROI",
      format: "pct" as const,
      values: [11.2, 11.6, 12.4, 13.1, 13.8, 14.2, 15.1]
    },
    {
      key: "roi",
      label: "ROI",
      format: "pct" as const,
      values: [8.4, 8.9, 9.6, 10.2, 10.8, 11.1, 11.9]
    },
    {
      key: "irr",
      label: "IRR",
      format: "pct" as const,
      values: [14.2, 14.2, 14.2, 14.2, 14.2, 14.2, 14.2]
    }
  ],
  chartNote: "Equity uses the left axis; income, expenses, and cash flow use the right axis."
} as const;

function fmtHeroZar(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R ${Math.round(n / 1_000)}k`;
  return `R ${n.toLocaleString("en-ZA")}`;
}

function fmtHeroPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Formatted cells for hero projection table */
export function formatHeroProjectionCell(format: "zar" | "pct", value: number): string {
  return format === "zar" ? fmtHeroZar(value) : fmtHeroPct(value);
}

/** Hero portfolio preview — aligned with homepagePreviewPortfolio */
export const homepageHeroAppPreview = {
  caption: "Sample portfolio · illustrative UI",
  pageTitle: "Portfolio dashboard",
  propertyCount: "6 properties",
  period: "Mar 2026",
  metrics: homepagePreviewPortfolio.metrics.map((m) => ({
    key: m.label.toLowerCase().replace(/\s+/g, "-"),
    label: m.label,
    value: m.value,
    change: m.change ?? "",
    changeTone: m.changeTone ?? "neutral",
    highlight: m.highlight,
    icon: m.icon
  })),
  projection: homepageHeroProjectionPreview
} as const;

/** @deprecated Use homepageHeroAppPreview */
export const homepageHeroDashboardMock = homepageHeroAppPreview;
