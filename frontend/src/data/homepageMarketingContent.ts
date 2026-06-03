/** Static marketing copy for the public homepage (no API). */

export {
  homepageHeroAppPreview,
  homepageHeroDashboardMock,
  homepagePreviewCalculator,
  homepagePreviewInvoice,
  homepagePreviewManagement,
  homepagePreviewPortfolio,
  homepagePreviewProperty,
  homepagePreviewReport,
  homepagePreviewStatement,
  homepageReportsPreviewMock
} from "./homepagePreviewContent";

export const MARKETING_SIGNUP_FREE_HREF = "/signup?plan=starter";
export const MARKETING_SIGN_IN_HREF = "/login";
export const MARKETING_PRICING_HREF = "/pricing";
export const MARKETING_PUBLIC_CALCULATORS_HREF = "/calculators";
export const MARKETING_HEADER_JOIN_HREF = MARKETING_SIGNUP_FREE_HREF;
export const MARKETING_HEADER_JOIN_LABEL = "Join";
export const MARKETING_HERO_DEMO_HREF = "#reports";

export const MARKETING_CTA_JOIN_FREE = { label: "Join Free", href: MARKETING_SIGNUP_FREE_HREF } as const;
export const MARKETING_CTA_VIEW_PRICING = { label: "View Pricing", href: MARKETING_PRICING_HREF } as const;
/** @deprecated Use MARKETING_CTA_VIEW_PRICING */
export const MARKETING_CTA_SEE_PRICING = MARKETING_CTA_VIEW_PRICING;
/** Optional longer label for non-homepage surfaces; homepage uses MARKETING_CTA_JOIN_FREE. */
export const MARKETING_CTA_START_FREE_PLAN = {
  label: "Start with Free Plan",
  href: MARKETING_SIGNUP_FREE_HREF
} as const;

export function marketingSignupPlanHref(planCode: string): string {
  return `/signup?plan=${planCode}`;
}

/** Shown where invoice/report scope vs payments must be clear (FAQ, management section). */
export const HOMEPAGE_WORKFLOW_DISCLAIMER =
  "Invoice and report workflows are available. Payment collection integrations are planned.";

export const homepageHero = {
  eyebrow: "For owner-managers & small portfolio investors",
  headline: "Stop spreadsheet chaos. See which properties are actually winning.",
  subheadline:
    "One workspace for portfolio analytics, rental admin and investor PDFs — connected data, cleaner decisions, less month-end reconciliation.",
  primaryCta: MARKETING_CTA_JOIN_FREE,
  secondaryCta: MARKETING_CTA_VIEW_PRICING,
  tertiaryCta: { label: "View Demo", href: MARKETING_HERO_DEMO_HREF }
} as const;

/** Credibility strip — factual product positioning only (no fake logos or testimonials). */
export const homepageTrustProof = {
  headline: "Built for property owners who manage their own rentals",
  subline: "Credible portfolio software for South African owner-managers — not agency trust-account software.",
  items: [
    { id: "owner-managers", icon: "tenants" as const, label: "Built for owner-managers" },
    { id: "small-portfolios", icon: "portfolio" as const, label: "Designed for small portfolio investors" },
    { id: "performance", icon: "activity" as const, label: "Track real portfolio performance" },
    { id: "reports", icon: "pdf" as const, label: "Generate investor-ready reports" },
    { id: "connected", icon: "leases" as const, label: "Leases, invoices, statements & analytics connected" },
    { id: "zar", icon: "wallet" as const, label: "South African pricing in ZAR" }
  ]
} as const;

/** @deprecated Use homepageTrustProof.items */
export const homepageTrustValues = homepageTrustProof.items.map((i) => i.label);

export const homepageWhoItsFor = {
  title: "Who it's for",
  lead: "Proplytic is for people who own and manage their own rental properties — and need numbers they can act on.",
  fit: [
    {
      title: "Owner-managers",
      body: "You self-manage tenants, leases and month-end without a letting agency running the books."
    },
    {
      title: "Small portfolio investors",
      body: "You hold a handful to a few dozen properties and want portfolio-level clarity, not per-file chaos."
    },
    {
      title: "Hands-on decision makers",
      body: "You buy, hold or sell based on cash flow, yield and equity — not gut feel from mismatched spreadsheets."
    }
  ],
  notFor:
    "Not built for estate agencies managing multiple landlords' trust accounts or high-volume letting operations.",
  cta: MARKETING_CTA_JOIN_FREE,
  secondaryCta: MARKETING_CTA_VIEW_PRICING
} as const;

export const homepageWhyProplytic = {
  title: "Why Proplytic",
  lead: "One connected workspace replaces scattered spreadsheets when your portfolio starts to matter.",
  bullets: [
    {
      icon: "portfolio" as const,
      title: "Portfolio truth in one place",
      body: "Equity, cash flow, yield and occupancy roll up from the same property records you maintain."
    },
    {
      icon: "pdf" as const,
      title: "Investor-ready PDF exports",
      body: "Projections, actuals and charts stakeholders expect — generated from live data, not rebuilt slides."
    },
    {
      icon: "leases" as const,
      title: "Admin that feeds analytics",
      body: "Tenants, leases, invoices and statements stay linked to the metrics on your dashboard."
    },
    {
      icon: "calculators" as const,
      title: "Property-type calculators",
      body: "Duplex, student housing, Airbnb and commercial each use tailored inputs — not one generic model."
    },
    {
      icon: "wallet" as const,
      title: "ZAR plans for smaller operators",
      body: "Start free on Starter. Upgrade when property count and reporting needs grow — priced in Rand."
    },
    {
      icon: "tools" as const,
      title: "Less spreadsheet reconciliation",
      body: "Stop copying rent and bond numbers between files every time someone asks for an update."
    }
  ],
  cta: MARKETING_CTA_JOIN_FREE,
  secondaryCta: MARKETING_CTA_VIEW_PRICING
} as const;

/** Compact CTA band repeated after key sections. */
export const homepageInlineCta = {
  default: {
    line: "Start free — connect your properties and see portfolio numbers in one place.",
    primary: MARKETING_CTA_JOIN_FREE,
    secondary: MARKETING_CTA_VIEW_PRICING
  },
  afterReports: {
    line: "Ready to export your first investor report?",
    primary: MARKETING_CTA_JOIN_FREE,
    secondary: MARKETING_CTA_VIEW_PRICING
  }
} as const;

export const homepageProblems = {
  eyebrow: "The problem",
  pain: "Every new property adds another spreadsheet — and another place for numbers to disagree.",
  title: "Why spreadsheets break as the portfolio grows",
  benefit:
    "Owner-managers and small portfolio investors end up fixing formulas instead of making hold, sell or buy calls.",
  cards: [
    {
      title: "Yield and cash flow never match",
      body: "Each property uses a different layout. Portfolio totals are always one revision behind."
    },
    {
      title: "Stakeholder reports take a weekend",
      body: "Lenders and partners want PDFs with projections and actuals — you rebuild them from scratch every time."
    },
    {
      title: "Rent and bond data live elsewhere",
      body: "Levies, invoices and bond schedules sit in separate files, so dashboard numbers can't be trusted."
    },
    {
      title: "Leases don't update the metrics",
      body: "Tenant changes and invoice history rarely flow back into the performance view you actually use."
    }
  ],
  cta: MARKETING_CTA_JOIN_FREE
} as const;

export const homepagePillars = {
  eyebrow: "The solution",
  pain: "You shouldn't need five tools to answer one portfolio question.",
  title: "One place for property numbers and management",
  benefit:
    "Record income, expenses, leases and assumptions once — then read the same truth on dashboards, statements and exports.",
  items: [
    {
      id: "connected",
      title: "Connected property records",
      body: "Bond, rent, levies and opex sit on the property — not in a side spreadsheet.",
      emphasis: true
    },
    {
      id: "portfolio",
      title: "Portfolio totals you can defend",
      body: "Equity, cash flow, yield and occupancy roll up across every unit without manual reconciliation."
    },
    {
      id: "admin",
      title: "Rental admin without agency bloat",
      body: "Tenants, leases, invoices and statements sized for owner-managers — not multi-landlord trust software."
    },
    {
      id: "decisions",
      title: "Clearer buy, hold and sell calls",
      body: "See which properties carry the portfolio — and which ones are quietly bleeding cash."
    }
  ],
  primaryCta: MARKETING_CTA_JOIN_FREE,
  secondaryCta: MARKETING_CTA_VIEW_PRICING
} as const;

export const homepageFeatureHighlights = {
  eyebrow: "Why Proplytic",
  pain: "Disconnected dashboards and invoices don't help you decide.",
  title: "Analytics, admin and reporting together",
  benefit:
    "Less spreadsheet chaos, stronger reporting and rental admin that feeds the same numbers you show investors.",
  outcomes: [
    {
      title: "Portfolio decisions in one view",
      body: "Track equity, cash flow, yield, IRR and occupancy without exporting to Excel."
    },
    {
      title: "Leases tied to live metrics",
      body: "Tenant and invoice activity stays linked to property performance — not buried in email."
    },
    {
      title: "Statements when tenants ask",
      body: "Property and tenant statements from recorded activity, ready for month-end."
    },
    {
      title: "Reports from data you already entered",
      body: "PDF investment exports use the same income, expenses and assumptions as your dashboard."
    }
  ],
  primaryCta: MARKETING_CTA_JOIN_FREE,
  secondaryCta: MARKETING_CTA_VIEW_PRICING
} as const;

export const homepagePublicCalculators = {
  eyebrow: "Run the numbers",
  pain: "A duplex and an Airbnb listing should not share the same generic calculator.",
  title: "Property-type-based calculators",
  benefit:
    "Model each structure with the right inputs — then move winning deals into your portfolio workspace.",
  logicNote:
    "Eight property types. Different questions. One consistent path to a report you can act on.",
  steps: [
    {
      number: 1,
      title: "Select property type",
      detail: "Duplex, student housing, Airbnb, commercial — eight structures, eight input models."
    },
    {
      number: 2,
      title: "Answer tailored questions",
      detail: "Only the fields that matter for that asset: units, beds, nightly rate or lease terms."
    },
    {
      number: 3,
      title: "Generate report",
      detail: "Cash flow, yield and return metrics you can compare before adding the deal to your portfolio."
    }
  ] as const,
  publicHubNote:
    "Bond, transfer, yield and more on the public calculator hub — no sign-in. Property-type calculators unlock free in your workspace after you join.",
  cta: { label: "Explore Calculators", href: MARKETING_PUBLIC_CALCULATORS_HREF },
  secondaryCta: MARKETING_CTA_VIEW_PRICING
} as const;

export const homepageReports = {
  eyebrow: "Investor-ready output",
  pain: "Partners and lenders don't want your spreadsheet — they want a structured report.",
  title: "Investor-ready PDF reports",
  benefit:
    "Send projections, actuals, charts and lease context in one export — built from the data already in Proplytic.",
  outcomes: [
    { title: "Minutes to export, not hours to rebuild", body: "Regenerate when rent or assumptions change." },
    { title: "Projections with your growth rates", body: "Future income and expense paths you control." },
    { title: "Actuals beside the model", body: "Received financials and analysis over time in one document." },
    { title: "Metrics stakeholders expect", body: "IRR, cash-on-cash, cap rate, 2% and 50% rules where relevant." }
  ],
  primaryCta: MARKETING_CTA_JOIN_FREE,
  secondaryCta: MARKETING_CTA_VIEW_PRICING
} as const;

export type HomepagePricingPreviewPlan = {
  code: string;
  name: string;
  priceLabel: string;
  pricePeriod?: string;
  priceDetail?: string;
  bestFor: string;
  includes: readonly string[];
  excludes?: readonly string[];
  cta: { label: string; href: string };
  recommended?: boolean;
  entry?: boolean;
  custom?: boolean;
};

export type HomepagePricingCompareRow = {
  label: string;
  starter: string;
  investor: string;
  portfolio: string;
  custom: string;
};

export const homepagePricing = {
  eyebrow: "Straightforward pricing",
  pain: "Most property software is priced for agencies — not for owners managing their own units.",
  title: "Pricing built for smaller operators",
  benefit: "ZAR plans sized for owner-managers — not letting-agency software with agency pricing.",
  tagline: "Start free, upgrade as your portfolio grows.",
  viewAllCta: { label: "View full plan comparison", href: MARKETING_PRICING_HREF },
  signupCta: MARKETING_CTA_JOIN_FREE
} as const;

export const homepagePricingCompareRows: HomepagePricingCompareRow[] = [
  { label: "Properties", starter: "3", investor: "10", portfolio: "30", custom: "75+" },
  { label: "Investor PDFs / month", starter: "3", investor: "10", portfolio: "Unlimited", custom: "Unlimited" },
  { label: "Property-type calculators", starter: "—", investor: "Included", portfolio: "Included", custom: "Included" },
  { label: "Rental admin", starter: "Basic", investor: "Full", portfolio: "Full", custom: "Full" }
];

export const homepagePricingPreviewPlans: HomepagePricingPreviewPlan[] = [
  {
    code: "starter",
    name: "Starter",
    priceLabel: "Free",
    bestFor: "Try Proplytic on your first properties",
    entry: true,
    includes: [
      "Up to 3 properties",
      "3 investor PDF reports per month",
      "Portfolio dashboard & property views",
      "Free public calculator hub"
    ],
    excludes: ["Full property-type calculators", "Full invoices, leases & statements"],
    cta: MARKETING_CTA_JOIN_FREE
  },
  {
    code: "investor",
    name: "Investor",
    priceLabel: "R299",
    pricePeriod: "pm",
    bestFor: "Owner-managers who need the full workspace",
    recommended: true,
    includes: [
      "Up to 10 properties",
      "10 investor PDF reports per month",
      "Property-type calculators & tailored inputs",
      "Full rental admin — tenants, leases, invoices"
    ],
    excludes: ["Unlimited monthly reports"],
    cta: { label: "Choose Investor", href: marketingSignupPlanHref("investor") }
  },
  {
    code: "portfolio",
    name: "Portfolio",
    priceLabel: "R599",
    pricePeriod: "pm",
    bestFor: "Growing portfolios that live in reports",
    includes: [
      "Up to 30 properties",
      "Unlimited investor PDF reports",
      "Advanced portfolio analytics",
      "Everything in Investor — at scale"
    ],
    cta: { label: "Choose Portfolio", href: marketingSignupPlanHref("portfolio") }
  },
  {
    code: "portfolio_pro",
    name: "Custom",
    priceLabel: "Talk to us",
    priceDetail: "Portfolio Pro & higher-volume needs",
    bestFor: "Larger owner-managed portfolios",
    custom: true,
    includes: [
      "75+ properties (Portfolio Pro)",
      "Priority support",
      "Advanced reporting depth",
      "Bespoke limits where required"
    ],
    cta: { label: "Contact Sales", href: "/contact" }
  }
];

export const homepageFaq = {
  eyebrow: "Before you sign up",
  title: "Questions owners ask before switching",
  lead: "Straight answers — no fake reviews, no payment smoke and mirrors.",
  items: [
    {
      q: "Who is Proplytic for?",
      a: "Owner-managers and small portfolio investors who own and self-manage rental properties. If you need portfolio analytics, investor PDFs and practical rental admin in one place — without agency software complexity — you're in the right audience."
    },
    {
      q: "Can I start for free?",
      a: "Yes. Starter is free with up to 3 properties and a monthly investor-report allowance. Create an account in minutes. Online card billing is not connected yet — you won't be charged at sign-up."
    },
    {
      q: "Is this for estate agents or property owners?",
      a: "Property owners and investors who manage their own units. Proplytic is not designed for estate agencies running many landlords' trust accounts or large letting operations."
    },
    {
      q: "Do I need to enter a credit card?",
      a: "No card is required for the free Starter plan. When paid billing is enabled later, you'll choose a plan from your account — nothing is charged today."
    },
    {
      q: "Can I generate investment reports?",
      a: "Yes. Export PDF reports with projections, actual received financials, charts and key metrics. The more complete your properties, leases and invoices are, the stronger the output — same data as your dashboard, not a separate rebuild."
    },
    {
      q: "Are public calculators free?",
      a: "Yes. Bond, transfer cost, yield and other tools on /calculators work without signing in. Your signed-in workspace adds property-type calculators and portfolio-linked reports."
    },
    {
      q: "Does Proplytic collect rent or process payments?",
      a: HOMEPAGE_WORKFLOW_DISCLAIMER
    },
    {
      q: "How does pricing work?",
      a: "Plans are in ZAR, based on property count and monthly report usage. Start free on Starter, then upgrade to Investor or Portfolio when you need more properties, full admin or unlimited reports. See the pricing page for a full comparison."
    },
    {
      q: "Can I change plans later?",
      a: "Yes. You can move between plans as your portfolio grows. Plan changes are available from subscription settings; card billing will be added when payments go live."
    }
  ]
} as const;

export const homepageFinalCta = {
  headline: "Understand your portfolio with clear, connected numbers.",
  lead: "Join free on Starter. Add properties, connect leases and invoices, and export investor-ready reports when you need them.",
  primary: MARKETING_CTA_JOIN_FREE,
  secondary: MARKETING_CTA_VIEW_PRICING
} as const;

/** @deprecated Use MARKETING_SIGNUP_FREE_HREF */
export const MARKETING_TRIAL_HREF = MARKETING_PRICING_HREF;
