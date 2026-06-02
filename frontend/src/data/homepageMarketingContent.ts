/** Static marketing copy for the public homepage (no API). */

export const MARKETING_TRIAL_HREF = "/pricing";
export const MARKETING_SIGN_IN_HREF = "/login";
export const MARKETING_PRICING_HREF = "/pricing";

/** Shown where invoice/report scope vs payments must be clear (FAQ, management section). */
export const HOMEPAGE_WORKFLOW_DISCLAIMER =
  "Invoice and report workflows are available. Payment collection integrations are planned.";

export const homepageHero = {
  eyebrow: "For owner-managed property portfolios",
  headline: "Know exactly how every property in your portfolio is performing.",
  subheadline:
    "Proplytic combines portfolio analytics, lease-based management, invoices, statements and investment reports in one dashboard built for owner-managed property portfolios.",
  primaryCta: { label: "Start free trial", href: MARKETING_TRIAL_HREF },
  secondaryCta: { label: "See how it works", href: "#features" }
} as const;

export const homepageTrustValues = [
  "Built for owner-managers",
  "Portfolio analytics first",
  "Investor-ready PDF reports",
  "South African pricing (ZAR)",
  "Mobile-friendly dashboard"
] as const;

export const homepageProblems = {
  title: "Spreadsheets do not scale with your portfolio.",
  cards: [
    "Performance numbers become inconsistent across properties.",
    "Investment reports take too long to rebuild.",
    "Income and expenses sit in different tools.",
    "Lease and invoice history is hard to reconcile."
  ]
} as const;

export const homepagePillars = {
  title: "One place for property performance and owner-management.",
  lead:
    "Proplytic helps property owners and small portfolio investors understand performance, manage core rental admin and generate investment reports.",
  items: [
    {
      id: "analytics",
      title: "Portfolio Analytics",
      body: "Track equity, income, expenses, cash flow, occupancy, yield, IRR and cash-on-cash return across your properties."
    },
    {
      id: "management",
      title: "Owner Management",
      body: "Manage properties, units, tenants, leases, invoices, recurring expenses and statements without losing the financial picture."
    },
    {
      id: "calculators",
      title: "Investment Calculators",
      body: "Select the property type, answer the right questions and generate projections tailored to single-family, duplex, multi-family, student housing, Airbnb, commercial and vacant land."
    },
    {
      id: "reports",
      title: "Investor Reports",
      body: "Generate PDF reports with future projections, actual received financials, property cards, tables and charts."
    }
  ]
} as const;

export const homepageFeatureHighlights = {
  title: "Analytics, core rental admin and reporting together",
  items: [
    "Property overview dashboards",
    "Lease-based tenant linking",
    "Invoice generation from lease data",
    "Property and tenant statements",
    "Recurring expenses",
    "Investment calculators by property type",
    "PDF investment reports",
    "Cash flow, yield, equity and IRR metrics"
  ]
} as const;

export const homepageReports = {
  title: "Investor-ready PDF reports.",
  lead:
    "Turn your property data into a report with property information, income and expenses, assumptions, analysis over time, projected vs actual results and investment metrics.",
  features: [
    "Future projections",
    "Actual received financials",
    "Analysis over time",
    "Income vs expenses",
    "IRR",
    "Cash on cash ROI",
    "2% rule",
    "50% rule",
    "Lease/tenant summary",
    "PDF export"
  ],
  primaryCta: { label: "Start free trial", href: MARKETING_TRIAL_HREF },
  secondaryCta: { label: "View pricing", href: MARKETING_PRICING_HREF }
} as const;

/** Static report page mock for marketing — not generated from user data. */
export const homepageReportsPreviewMock = {
  disclaimer: "Illustrative preview only",
  headerTitle: "Property investment report",
  propertyLine: "Sample property · Duplex",
  metrics: [
    { label: "IRR (10yr)", value: "14.2%" },
    { label: "Cash on cash", value: "11.8%" },
    { label: "Cap rate", value: "7.6%" },
    { label: "Monthly cash flow", value: "R 18,400" }
  ],
  table: {
    caption: "Projected vs actual (excerpt)",
    headers: ["Period", "Income", "Expenses", "Net"],
    rows: [
      ["Y1 proj.", "R 302k", "R 198k", "R 104k"],
      ["Y1 actual", "R 296k", "R 201k", "R 95k"],
      ["Y5 proj.", "R 358k", "R 224k", "R 134k"]
    ]
  },
  chartCaption: "Net cash flow by year (illustrative)",
  chartBars: [38, 52, 48, 61, 58, 72, 68, 78] as const
} as const;

export const homepageCalculators = {
  title: "Calculators built around the property type.",
  lead:
    "Airbnb, student housing and multi-family properties do not behave like a single rental unit. Proplytic asks the right questions for each property type.",
  flowSteps: [
    {
      step: 1,
      title: "Select property type",
      detail: "Choose from eight property types — each with its own input model."
    },
    {
      step: 2,
      title: "Answer tailored questions",
      detail: "Questions adapt to beds, occupancy, fees, units or lease structure."
    },
    {
      step: 3,
      title: "Generate report",
      detail: "Review projections, metrics and assumptions in a structured output."
    }
  ],
  cta: { label: "Open calculators", href: "/calculators" }
} as const;

export const homepageManagement = {
  title: "Core rental admin in the same workspace as your numbers.",
  lead: `Keep properties, tenants and financials connected so portfolio metrics stay current. ${HOMEPAGE_WORKFLOW_DISCLAIMER}`,
  items: [
    { label: "Tenants", detail: "Profiles, contacts and lease links" },
    { label: "Leases", detail: "Terms, rent and status tracking" },
    { label: "Invoices", detail: "Generation, balances and manual payment records" },
    { label: "Statements", detail: "Property and tenant monthly views" },
    { label: "Expenses", detail: "One-off and recurring schedules" },
    { label: "Reports", detail: "Saved PDFs and regeneration" },
    { label: "Settings", detail: "Defaults for growth, branding and assumptions" }
  ]
} as const;

export type HomepagePricingPreviewPlan = {
  code: string;
  name: string;
  priceLabel: string;
  priceDetail?: string;
  bestFor: string;
  bullets: readonly [string, string, string];
  cta: { label: string; href: string };
  highlighted?: boolean;
};

/** Marketing preview — limits and trial terms on /pricing (no payment on homepage). */
export const homepagePricing = {
  title: "Plans for owner-managed portfolios",
  lead: "Preview monthly pricing in ZAR. The pricing page has full plan limits, trial terms and signup options.",
  viewAllCta: { label: "View full pricing", href: MARKETING_PRICING_HREF }
} as const;

export const homepagePricingPreviewPlans: HomepagePricingPreviewPlan[] = [
  {
    code: "starter",
    name: "Starter",
    priceLabel: "14-day free trial",
    priceDetail: "then R99/month",
    bestFor: "First-time owner-managers",
    bullets: [
      "Portfolio analytics to get started",
      "Core property and report limits",
      "Evaluate Proplytic on your first properties"
    ],
    cta: { label: "See Starter plan", href: MARKETING_PRICING_HREF }
  },
  {
    code: "investor",
    name: "Investor",
    priceLabel: "R299/month",
    bestFor: "Active owner-managers",
    bullets: [
      "Calculators and management software",
      "Up to 10 properties",
      "10 investment reports"
    ],
    cta: { label: "See Investor plan", href: MARKETING_PRICING_HREF },
    highlighted: true
  },
  {
    code: "portfolio",
    name: "Portfolio",
    priceLabel: "R599/month",
    bestFor: "Growing portfolios",
    bullets: [
      "Calculators and management software",
      "Up to 30 properties",
      "Unlimited reports"
    ],
    cta: { label: "See Portfolio plan", href: MARKETING_PRICING_HREF }
  },
  {
    code: "portfolio_pro",
    name: "Portfolio Pro",
    priceLabel: "Custom",
    priceDetail: "pricing on request",
    bestFor: "Larger portfolios and advanced reporting",
    bullets: [
      "Higher property capacity",
      "Advanced reporting needs",
      "Contact us for a tailored quote"
    ],
    cta: { label: "See Portfolio Pro", href: MARKETING_PRICING_HREF }
  }
];

export const homepageFaq = [
  {
    q: "Who is Proplytic for?",
    a: "Owner-managers and small portfolio investors who own and manage their own rental properties. Analytics and investor reports are the main value; core rental admin is included in the same workspace."
  },
  {
    q: "Is this for agents or property owners?",
    a: "Property owners and investors. Proplytic is not built as letting-agency software for managing many landlords' trust accounts."
  },
  {
    q: "Is it a full agency trust-accounting replacement?",
    a: "Not yet. Proplytic supports practical owner-management workflows, but it is not positioned as a full agency trust-accounting replacement. Portfolio analytics and PDF investment reports remain the primary focus."
  },
  {
    q: "Can I generate investment reports?",
    a: "Yes. You can generate PDF reports with future projections, actual received financials (from data you record), property cards, tables and charts. Output quality depends on how complete your property, lease and invoice data is."
  },
  {
    q: "Can I manage tenants, leases and invoices?",
    a: "Yes. You can manage properties, units, tenants, leases, invoices, expenses and statements alongside your portfolio metrics."
  },
  {
    q: "Does it support Airbnb-style properties?",
    a: "Yes. Short-term rental is a supported property type in the investment calculator and reporting flows."
  },
  {
    q: "Is payment processing included?",
    a: HOMEPAGE_WORKFLOW_DISCLAIMER
  },
  {
    q: "How does pricing work?",
    a: "Pricing starts with a trial and paid plans in ZAR. Visit the pricing page for current plan limits, trial terms and monthly prices."
  }
] as const;

export const homepageFinalCta = {
  headline: "Understand your portfolio with clear, connected numbers.",
  primary: { label: "Start free trial", href: MARKETING_TRIAL_HREF },
  secondary: { label: "View pricing", href: MARKETING_PRICING_HREF }
} as const;

/** Static hero dashboard mock — not loaded from Supabase or user session. */
export const homepageHeroDashboardMock = {
  disclaimer: "Sample portfolio data for illustration",
  metrics: [
    { key: "portfolio-value", label: "Portfolio Value", value: "R 12.4M", hint: "+6.8% YoY", tone: "primary" as const },
    { key: "cash-flow", label: "Monthly Cash Flow", value: "R 41,200", hint: "After debt & opex", tone: "success" as const },
    { key: "coc", label: "Cash on Cash ROI", value: "12.4%", hint: "Y1 projection", tone: "info" as const },
    { key: "occupancy", label: "Occupancy", value: "94%", hint: "8 of 8 units", tone: "warning" as const }
  ],
  reportPreview: {
    title: "Investment report preview",
    status: "PDF ready",
    rows: [
      { label: "IRR (10yr)", value: "14.2%" },
      { label: "Proj. vs actual", value: "+2.1%" },
      { label: "Cap rate", value: "7.8%" }
    ]
  },
  chart: {
    caption: "Monthly net cash flow (illustrative)",
    bars: [42, 58, 52, 68, 64, 78, 72, 86] as const
  }
} as const;
