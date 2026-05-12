/**
 * Marketing hero copy + curated “related calculators” for each tool page.
 * The monthly bond page (`monthly-payment`) uses the hub mortgage section — excluded here.
 */

export type CalculatorToolPageDef = {
  /** Text before the gold accent fragment */
  titleBefore: string;
  /** Gold accent (typically the core metric or topic) */
  accent: string;
  /** Text after the accent (often “.”) */
  titleAfter: string;
  /** Short hero subtitle under the title */
  lead: string;
  /** Calculator slugs that directly inform this tool (no full hub list) */
  relatedSlugs: string[];
};

export const CALCULATOR_TOOL_PAGE: Record<string, CalculatorToolPageDef> = {
  "transfer-bond-costs": {
    titleBefore: "Estimate your ",
    accent: "transfer & bond costs",
    titleAfter: ".",
    lead: "Transfer duty, conveyancer fees, Deeds Office fees and bond registration — before you sign an offer.",
    relatedSlugs: ["monthly-payment", "ltv", "cash-on-cash-return", "cash-flow"]
  },
  "cash-flow": {
    titleBefore: "Model your property ",
    accent: "monthly cash flow",
    titleAfter: ".",
    lead: "Rent, vacancy, operating costs and bond payment — see if the deal is cash-flow positive.",
    relatedSlugs: ["noi", "dscr", "cash-on-cash-return", "monthly-payment"]
  },
  "cash-on-cash-return": {
    titleBefore: "Measure your ",
    accent: "cash-on-cash return",
    titleAfter: ".",
    lead: "Annual pre-tax cash flow versus total cash invested — the classic buy-to-let hurdle rate.",
    relatedSlugs: ["cash-flow", "noi", "transfer-bond-costs", "monthly-payment"]
  },
  noi: {
    titleBefore: "Calculate your ",
    accent: "Net Operating Income",
    titleAfter: ".",
    lead: "Income after vacancy and operating expenses — before bond payments, tax and capital items.",
    relatedSlugs: ["cap-rate", "dscr", "cash-flow", "operating-expense-ratio"]
  },
  "cap-rate": {
    titleBefore: "Compare yield with ",
    accent: "cap rate",
    titleAfter: ".",
    lead: "Annual NOI divided by property value — a quick way to rank deals independent of your financing.",
    relatedSlugs: ["noi", "grm", "dcf"]
  },
  dscr: {
    titleBefore: "Stress-test ",
    accent: "debt coverage",
    titleAfter: ".",
    lead: "Annual NOI versus annual debt service — lenders and conservative investors watch this closely.",
    relatedSlugs: ["noi", "monthly-payment", "cash-flow"]
  },
  irr: {
    titleBefore: "Solve for ",
    accent: "IRR",
    titleAfter: " on your hold.",
    lead: "Discount rate where the net present value of your cash flows (including exit) hits zero.",
    relatedSlugs: ["dcf", "cash-on-cash-return", "cap-rate"]
  },
  brrrr: {
    titleBefore: "Run a ",
    accent: "BRRRR",
    titleAfter: " scenario.",
    lead: "Buy, renovate, rent, refinance — see cash left in the deal and cash-on-cash after the new loan.",
    relatedSlugs: ["monthly-payment", "cash-flow", "noi", "transfer-bond-costs"]
  },
  "short-term-rental": {
    titleBefore: "Forecast ",
    accent: "short-stay revenue",
    titleAfter: ".",
    lead: "ADR, occupancy, platform fees and operating costs — a simple Airbnb-style monthly view.",
    relatedSlugs: ["cash-flow", "noi", "operating-expense-ratio"]
  },
  "70-rule": {
    titleBefore: "Apply the ",
    accent: "70% rule",
    titleAfter: " to a flip.",
    lead: "Quick maximum offer check against ARV, repairs and your profit buffer — screening, not a substitute for due diligence.",
    relatedSlugs: ["flip-profit", "wholesale-profit", "rehab-cost"]
  },
  "flip-profit": {
    titleBefore: "Estimate ",
    accent: "flip profit",
    titleAfter: " and ROI.",
    lead: "Purchase, rehab, holding and sale — see profit, margin and break-even sale price.",
    relatedSlugs: ["70-rule", "wholesale-profit", "rehab-cost"]
  },
  "wholesale-profit": {
    titleBefore: "Price a ",
    accent: "wholesale",
    titleAfter: " assignment.",
    lead: "Buyer max offer, repair margin and your assignment fee — keep the spread realistic.",
    relatedSlugs: ["70-rule", "flip-profit"]
  },
  "rehab-cost": {
    titleBefore: "Build a ",
    accent: "rehab budget",
    titleAfter: " from line items.",
    lead: "Line-item costs plus contingency — export thinking into your flip or BRRRR model.",
    relatedSlugs: ["flip-profit", "70-rule", "transfer-bond-costs"]
  },
  "rent-to-cost-ratio": {
    titleBefore: "Screen with ",
    accent: "rent-to-cost",
    titleAfter: " ratios.",
    lead: "Monthly rent versus price (and optional total acquisition) — 1% / 2% style rules of thumb.",
    relatedSlugs: ["grm", "cap-rate", "noi"]
  },
  grm: {
    titleBefore: "Value with ",
    accent: "gross rent multiplier",
    titleAfter: ".",
    lead: "Price divided by gross annual rent — fast, coarse screening (ignores expenses and finance).",
    relatedSlugs: ["rent-to-cost-ratio", "cap-rate"]
  },
  ltv: {
    titleBefore: "Check your ",
    accent: "loan-to-value",
    titleAfter: ".",
    lead: "Loan balance versus property value — leverage, equity and refinancing headroom at a glance.",
    relatedSlugs: ["monthly-payment", "transfer-bond-costs", "cap-rate"]
  },
  dcf: {
    titleBefore: "Discount cash flows — see ",
    accent: "NPV",
    titleAfter: " at your hurdle rate.",
    lead: "Initial investment, annual flows, exit and discount rate — see if the deal clears your hurdle.",
    relatedSlugs: ["irr", "cap-rate"]
  },
  "operating-expense-ratio": {
    titleBefore: "Track your ",
    accent: "operating expense ratio",
    titleAfter: ".",
    lead: "Operating expenses divided by gross income — are you running lean or under-provisioning costs?",
    relatedSlugs: ["noi", "cash-flow"]
  },
  "square-footage": {
    titleBefore: "Convert ",
    accent: "area",
    titleAfter: " (m² ↔ ft²).",
    lead: "Length × width in metres — useful for levies, rates bands and rough build scope.",
    relatedSlugs: ["rent-to-cost-ratio", "rehab-cost"]
  }
};

export function getCalculatorToolPage(slug: string): CalculatorToolPageDef | null {
  if (slug === "monthly-payment") return null;
  return (
    CALCULATOR_TOOL_PAGE[slug] ?? {
      titleBefore: "",
      accent: slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      titleAfter: "",
      lead: "Estimate, stress-test and save scenarios to your report library.",
      relatedSlugs: ["noi", "cap-rate", "cash-flow"]
    }
  );
}
