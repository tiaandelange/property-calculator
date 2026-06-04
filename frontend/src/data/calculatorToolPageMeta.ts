import { calculators } from "./calculators";
import type { CalculatorHubCategoryId } from "./calculatorHubDirectory";
import { calculatorHubDirectoryGroups } from "./calculatorHubDirectory";
import type { IconName } from "../components/icons/iconRegistry";

export type CalculatorUnderstandingBlock = {
  title: string;
  body: string;
  icon?: IconName;
};

export type CalculatorToolPageMeta = {
  seoTitle: string;
  seoDescription: string;
  seoHeading: string;
  pageDescription: string;
  primaryResultTitle: string;
  proTip: string;
  understanding: CalculatorUnderstandingBlock[];
  categoryId?: Exclude<CalculatorHubCategoryId, "all">;
  icon?: IconName;
};

const META: Partial<Record<string, CalculatorToolPageMeta>> = {
  "monthly-payment": {
    seoTitle: "Monthly Bond Payment Calculator | Proplytic",
    seoDescription:
      "Calculate your estimated monthly home loan repayment, total interest, total repayment and amortisation breakdown.",
    seoHeading: "Monthly Bond Payment Calculator",
    pageDescription:
      "Calculate your estimated monthly home loan repayment, total interest, total repayment and amortisation breakdown.",
    primaryResultTitle: "Your Estimated Monthly Payment",
    proTip:
      "A larger deposit or longer term can lower your monthly payment, but it may increase or reduce total interest depending on the loan structure.",
    categoryId: "purchase-financing",
    understanding: [
      { title: "Monthly Payment", body: "This is the amount you'll pay each month over the loan term.", icon: "wallet" },
      { title: "Interest", body: "The cost of borrowing money from the lender over the loan term.", icon: "percent" },
      { title: "Principal", body: "The amount that goes towards paying off your loan balance.", icon: "income" },
      { title: "Term", body: "A longer term can reduce monthly payments but may increase total interest.", icon: "calendar" }
    ]
  },
  "buy-vs-rent": {
    seoTitle: "Buy vs Rent Calculator | Proplytic",
    seoDescription: "Compare the long-term financial outcome of buying a property versus renting over time.",
    seoHeading: "Buy vs Rent Calculator",
    pageDescription: "Compare the long-term financial outcome of buying a property versus renting over time.",
    primaryResultTitle: "Your Buy vs Rent Comparison",
    proTip:
      "Small changes in how long you stay, rent growth, or property appreciation can flip the verdict — stress-test a few scenarios.",
    categoryId: "purchase-financing",
    understanding: [
      { title: "Monthly cost", body: "Compares estimated monthly cost of owning versus renting for each year." },
      { title: "Wealth position", body: "Tracks net position after bond, equity and invested savings if you rent." },
      { title: "Upfront cash", body: "Deposit, transfer costs and bond registration affect the buy path early on." },
      { title: "Assumptions", body: "Growth rates and running costs are estimates — confirm with your advisor." }
    ]
  },
  "cash-flow": {
    seoTitle: "Rental Cash Flow Calculator | Proplytic",
    seoDescription:
      "Estimate your monthly rental income, operating expenses, debt service and net property cash flow.",
    seoHeading: "Rental Cash Flow Calculator",
    pageDescription:
      "Estimate your monthly rental income, operating expenses, debt service and net property cash flow.",
    primaryResultTitle: "Your Estimated Net Cash Flow",
    proTip: "Model vacancy and maintenance conservatively — small percentage changes can erase thin margins.",
    categoryId: "income-operations",
    understanding: [
      { title: "Gross income", body: "Rent collected before vacancy and operating costs.", icon: "income" },
      { title: "Operating expenses", body: "Rates, levies, insurance, maintenance and other running costs.", icon: "expense" },
      { title: "Debt service", body: "Bond payment reduces cash left after operating expenses.", icon: "calculators" },
      { title: "Net cash flow", body: "What remains each month after all costs and the loan.", icon: "wallet" }
    ]
  },
  "transfer-bond-costs": {
    seoTitle: "Transfer and Bond Costs Calculator South Africa | Proplytic",
    seoDescription:
      "Estimate transfer duty, bond registration costs, attorney fees and the total cash needed to register a property in South Africa.",
    seoHeading: "Transfer and Bond Costs Calculator South Africa",
    pageDescription:
      "Estimate transfer duty, bond registration costs, attorney fees and the total cash needed to register a property in South Africa.",
    primaryResultTitle: "Your Estimated Total Cash to Register",
    proTip: "Request written conveyancer quotes before transfer — disbursements and bank charges vary by firm and property.",
    categoryId: "purchase-financing",
    understanding: [
      { title: "Transfer duty", body: "SARS tax on acquisition where applicable — not charged on qualifying VAT deals." },
      { title: "Conveyancer fees", body: "Professional fees, VAT, Deeds Office and typical disbursements on transfer." },
      { title: "Bond registration", body: "Separate bond attorney fees and Deeds Office bond registration." },
      { title: "Cash to register", body: "Sum of transfer-side and bond-side costs before you move in." }
    ]
  },
  "cash-on-cash-return": {
    seoTitle: "Cash-on-Cash ROI Calculator | Proplytic",
    seoDescription: "Measure annual pre-tax cash return on the total cash you invested in a property.",
    seoHeading: "Cash-on-Cash ROI Calculator",
    pageDescription: "Measure annual pre-tax cash return on the total cash you invested in a property.",
    primaryResultTitle: "Your Cash-on-Cash Return",
    proTip: "Include transfer costs and rehab in cash invested — understating cash in inflates your yield.",
    categoryId: "income-operations",
    understanding: [
      { title: "Annual cash flow", body: "Net cash after operating costs and debt service, before tax." },
      { title: "Cash invested", body: "Deposit, costs and capital spent to acquire and ready the asset." },
      { title: "CoC %", body: "Annual cash flow divided by cash invested — a common buy-to-let hurdle." },
      { title: "Leverage", body: "Higher LTV can lift CoC but increases risk if rates or vacancy move." }
    ]
  },
  ltv: {
    seoTitle: "Loan-to-Value (LTV) Calculator | Proplytic",
    seoDescription: "Calculate loan size and loan-to-value ratio based on property value and deposit.",
    seoHeading: "Loan-to-Value (LTV) Calculator",
    pageDescription: "Calculate loan size based on property value and your deposit or equity position.",
    primaryResultTitle: "Your Loan-to-Value Ratio",
    proTip: "Banks often cap LTV by segment — confirm your approved limit before relying on this ratio.",
    categoryId: "purchase-financing",
    understanding: [
      { title: "Loan amount", body: "Principal borrowed against the property value." },
      { title: "Property value", body: "Purchase price or estimated market value used in the ratio." },
      { title: "LTV %", body: "Loan divided by value — lower LTV usually means better terms." },
      { title: "Equity", body: "The value cushion you hold above the loan." }
    ]
  },
  "square-footage": {
    seoTitle: "Square Footage / Area Calculator | Proplytic",
    seoDescription: "Convert property area between square metres and square feet and estimate rent per unit.",
    seoHeading: "Square Footage / Area Calculator",
    pageDescription: "Convert areas and calculate rent per square foot or square metre.",
    primaryResultTitle: "Your Area Conversion",
    proTip: "Use consistent units when comparing listings — agents may mix m² and ft² in brochures.",
    categoryId: "purchase-financing",
    understanding: [
      { title: "Area", body: "Length × width (or total lettable area) in your chosen unit." },
      { title: "Conversion", body: "Standard factors between m² and ft² for quick comparisons." },
      { title: "Rent per unit", body: "Monthly rent divided by area — useful for like-for-like comparisons." },
      { title: "Limits", body: "Does not account for shape, common areas or exclusive-use yards." }
    ]
  },
  "cap-rate": {
    seoTitle: "Rental Yield / Cap Rate Calculator | Proplytic",
    seoDescription: "Calculate net operating income yield (cap rate) versus property value.",
    seoHeading: "Rental Yield Calculator",
    pageDescription: "Calculate net operating income yield independent of how you finance the deal.",
    primaryResultTitle: "Your Cap Rate",
    proTip: "Cap rate ignores finance and tax — pair it with cash-on-cash when you use a bond.",
    categoryId: "investment-analysis",
    understanding: [
      { title: "NOI", body: "Income after operating expenses, before debt and capital items." },
      { title: "Value", body: "Purchase price or current market value in the denominator." },
      { title: "Cap rate", body: "NOI ÷ value — higher cap rate implies higher yield on price." },
      { title: "Screening", body: "Useful to rank deals quickly, not a substitute for full cash-flow modelling." }
    ]
  },
  irr: {
    seoTitle: "IRR / Total Return Calculator | Proplytic",
    seoDescription: "Estimate internal rate of return over your hold period including exit proceeds.",
    seoHeading: "Total Return Calculator",
    pageDescription: "Estimate internal rate of return over your investment horizon.",
    primaryResultTitle: "Your Internal Rate of Return",
    proTip: "IRR is sensitive to exit assumptions — test conservative and optimistic sale prices.",
    categoryId: "investment-analysis",
    understanding: [
      { title: "Cash flows", body: "Initial outlay plus annual net cash flows over the hold." },
      { title: "Exit", body: "Sale proceeds net of costs and remaining debt at the end of the period." },
      { title: "IRR", body: "Discount rate where NPV of all flows equals zero." },
      { title: "Hurdle rate", body: "Compare IRR to your minimum acceptable return." }
    ]
  },
  noi: {
    seoTitle: "Net Operating Income (NOI) Calculator | Proplytic",
    seoDescription: "Calculate property NOI after vacancy, operating expenses and maintenance.",
    seoHeading: "Net Operating Income Calculator",
    pageDescription: "Income after vacancy and operating expenses — before bond payments and tax.",
    primaryResultTitle: "Your Net Operating Income",
    proTip: "Line-item expenses beat a single guess — rates, insurance and levies often surprise new landlords.",
    categoryId: "income-operations",
    understanding: [
      { title: "Effective gross", body: "Rent after vacancy and other income adjustments." },
      { title: "Operating expenses", body: "Recurring costs to run the property, excluding debt." },
      { title: "NOI", body: "What's left to service debt and fund reserves." },
      { title: "Projection", body: "Growth assumptions drive multi-year NOI charts where enabled." }
    ]
  },
  "operating-expense-ratio": {
    seoTitle: "Operating Expense Ratio Calculator | Proplytic",
    seoDescription: "See operating expenses as a percentage of gross rental income.",
    seoHeading: "Expense Ratio Calculator",
    pageDescription: "See what percentage of income goes to operating expenses.",
    primaryResultTitle: "Your Operating Expense Ratio",
    proTip: "Compare to similar assets in the same sub-market — old stock often carries higher ratios.",
    categoryId: "income-operations",
    understanding: [
      { title: "Gross income", body: "Total rental income before expenses." },
      { title: "Operating costs", body: "Recurring costs excluding debt and capital improvements." },
      { title: "OER %", body: "Expenses ÷ income — lower usually means leaner operations." },
      { title: "Benchmarks", body: "Use as a screening tool alongside absolute cash flow." }
    ]
  },
  dscr: {
    seoTitle: "Debt Service Coverage Ratio Calculator | Proplytic",
    seoDescription: "Compare annual NOI to annual debt service — a key lender metric.",
    seoHeading: "Debt Service Coverage Calculator",
    pageDescription: "See whether rental income comfortably covers bond payments.",
    primaryResultTitle: "Your Debt Service Coverage Ratio",
    proTip: "Lenders often want DSCR above 1.2–1.25 on investment property — confirm with your bank.",
    categoryId: "investment-analysis",
    understanding: [
      { title: "NOI", body: "Net operating income available to cover debt." },
      { title: "Debt service", body: "Annual principal and interest on the loan." },
      { title: "DSCR", body: "NOI ÷ debt service — below 1.0 means income does not cover the bond." },
      { title: "Stress test", body: "Model higher rates or vacancy before you commit." }
    ]
  },
  dcf: {
    seoTitle: "Discounted Cash Flow Calculator | Proplytic",
    seoDescription: "Discount future property cash flows to today's value at your hurdle rate.",
    seoHeading: "Discounted Cash Flow Calculator",
    pageDescription: "Present value of future cash flows at your required return.",
    primaryResultTitle: "Your Net Present Value",
    proTip: "Small changes in discount rate or exit cap materially shift NPV — sensitivity-test both.",
    categoryId: "investment-analysis",
    understanding: [
      { title: "Cash flows", body: "Projected annual amounts in and out of the investment." },
      { title: "Discount rate", body: "Your required return — higher rate lowers present value." },
      { title: "NPV", body: "Sum of discounted flows — positive NPV beats your hurdle in theory." },
      { title: "Exit value", body: "Terminal sale or refinance proceeds included in the model." }
    ]
  },
  brrrr: {
    seoTitle: "BRRRR Calculator | Proplytic",
    seoDescription: "Model buy, rehab, rent, refinance and cash left in the deal.",
    seoHeading: "BRRRR Calculator",
    pageDescription: "Buy, rehab, rent, refinance — see cash left in and returns after refinance.",
    primaryResultTitle: "Your Post-Refinance Position",
    proTip: "Conservative ARV and rehab contingency protect you if the refinance appraisal comes in low.",
    categoryId: "other",
    understanding: [
      { title: "All-in cost", body: "Purchase plus rehab and holding costs to stabilization." },
      { title: "Stabilized rent", body: "Income used to qualify for the refinance loan." },
      { title: "Refinance proceeds", body: "New loan sized by LTV on appraised value." },
      { title: "Cash left in", body: "Capital still in the deal after you pull equity out." }
    ]
  },
  "short-term-rental": {
    seoTitle: "Short-term Rental Income Calculator | Proplytic",
    seoDescription: "Estimate Airbnb-style revenue after occupancy, fees and operating costs.",
    seoHeading: "Short-term Rental Calculator",
    pageDescription: "Nightly rate, occupancy and platform fees — monthly and annual revenue view.",
    primaryResultTitle: "Your Estimated Net Revenue",
    proTip: "Seasonality and regulation can swing occupancy — use conservative occupancy in year one.",
    categoryId: "other",
    understanding: [
      { title: "Gross bookings", body: "Nightly rate × occupied nights before fees." },
      { title: "Platform fees", body: "Host commission and payment processing." },
      { title: "Operating costs", body: "Cleaning, utilities, consumables and management." },
      { title: "Net income", body: "What's left to compare against long-term rental alternatives." }
    ]
  },
  "70-rule": {
    seoTitle: "70% Rule Calculator | Proplytic",
    seoDescription: "Quick maximum offer check for fix-and-flip deals using ARV and repairs.",
    seoHeading: "70% Rule Calculator",
    pageDescription: "Maximum offer screening against after-repair value and rehab budget.",
    primaryResultTitle: "Your Maximum Offer (70% Rule)",
    proTip: "The 70% rule is a screen, not a bid — tight markets often require thinner margins.",
    categoryId: "other",
    understanding: [
      { title: "ARV", body: "Expected value after repairs and stabilization." },
      { title: "Repairs", body: "Budget to renovate to ARV condition." },
      { title: "Max offer", body: "ARV × rule percentage minus repairs." },
      { title: "Margin", body: "Built-in buffer for holding, sale costs and profit." }
    ]
  },
  "flip-profit": {
    seoTitle: "Flip Profit Calculator | Proplytic",
    seoDescription: "Estimate profit, margin and ROI on a fix-and-flip after all costs.",
    seoHeading: "Flip Profit Calculator",
    pageDescription: "Purchase, rehab, holding and sale — profit and return after costs.",
    primaryResultTitle: "Your Estimated Flip Profit",
    proTip: "Include holding costs and selling commission — they often erase thin flip margins.",
    categoryId: "other",
    understanding: [
      { title: "All-in cost", body: "Purchase, rehab, holding and selling costs combined." },
      { title: "Sale price", body: "Expected exit after marketing period." },
      { title: "Profit", body: "Sale proceeds minus total project cost." },
      { title: "ROI", body: "Return on cash invested in the flip." }
    ]
  },
  "wholesale-profit": {
    seoTitle: "Wholesale Profit Calculator | Proplytic",
    seoDescription: "Model assignment fees and spread between contract and buyer price.",
    seoHeading: "Wholesale Profit Calculator",
    pageDescription: "Assignment fee and spread between your contract and end-buyer price.",
    primaryResultTitle: "Your Wholesale Profit",
    proTip: "Build in legal and marketing costs — net assignment fee is what you actually keep.",
    categoryId: "other",
    understanding: [
      { title: "Contract price", body: "What you control under the purchase agreement." },
      { title: "Buyer price", body: "What your end investor pays to take the deal." },
      { title: "Assignment fee", body: "Difference minus costs — your wholesale profit." },
      { title: "Risk", body: "Ensure contract terms allow assignment in your jurisdiction." }
    ]
  },
  "rehab-cost": {
    seoTitle: "Rehab Cost Calculator | Proplytic",
    seoDescription: "Total renovation budget from line items plus contingency.",
    seoHeading: "Rehab Cost Calculator",
    pageDescription: "Line-item renovation costs plus contingency for flips and BRRRR projects.",
    primaryResultTitle: "Your Total Rehab Budget",
    proTip: "Add contingency for unknowns — kitchens, roofs and damp often run over first estimates.",
    categoryId: "other",
    understanding: [
      { title: "Line items", body: "Trade-by-trade or room-by-room cost build-up." },
      { title: "Contingency", body: "Buffer for scope creep and surprises." },
      { title: "Total rehab", body: "Sum used in flip, BRRRR and offer models." },
      { title: "Timeline", body: "Longer rehab increases holding costs elsewhere." }
    ]
  },
  "rent-to-cost-ratio": {
    seoTitle: "Rent-to-Cost Ratio Calculator | Proplytic",
    seoDescription: "Compare monthly rent to purchase price and total acquisition cost.",
    seoHeading: "Rent-to-Cost Ratio Calculator",
    pageDescription: "Monthly rent versus price — 1% / 2% style screening rules.",
    primaryResultTitle: "Your Rent-to-Cost Ratio",
    proTip: "The 1% rule is coarse — always follow with full cash-flow and transfer cost modelling.",
    categoryId: "investment-analysis",
    understanding: [
      { title: "Monthly rent", body: "Expected rent on day one." },
      { title: "Price", body: "Purchase price or total acquisition cost." },
      { title: "Ratio", body: "Rent ÷ price — higher can imply better gross yield." },
      { title: "Limits", body: "Ignores vacancy, expenses and finance." }
    ]
  },
  grm: {
    seoTitle: "Gross Rent Multiplier Calculator | Proplytic",
    seoDescription: "Price divided by gross annual rent — fast screening metric.",
    seoHeading: "Gross Rent Multiplier Calculator",
    pageDescription: "Price divided by gross annual rent — quick, coarse comparison.",
    primaryResultTitle: "Your Gross Rent Multiplier",
    proTip: "Lower GRM can mean cheaper rent multiple — still validate expenses and location.",
    categoryId: "investment-analysis",
    understanding: [
      { title: "Gross rent", body: "Annual rent before expenses." },
      { title: "Price", body: "Acquisition cost or market value." },
      { title: "GRM", body: "Price ÷ gross rent — years of rent to equal price." },
      { title: "Coarse tool", body: "Does not replace NOI or cash-flow analysis." }
    ]
  }
};

function findCategoryIdForSlug(slug: string): Exclude<CalculatorHubCategoryId, "all"> | undefined {
  for (const group of calculatorHubDirectoryGroups) {
    const match = group.items.find((item) => item.kind === "tool" && item.slug === slug);
    if (match) return group.categoryId;
  }
  return undefined;
}

function defaultMeta(slug: string): CalculatorToolPageMeta {
  const calc = calculators.find((c) => c.slug === slug);
  const name = calc?.name ?? slug;
  const desc = calc?.description ?? "South African property calculator.";
  return {
    seoTitle: `${name} | Proplytic`,
    seoDescription: desc,
    seoHeading: `${name}${name.toLowerCase().includes("calculator") ? "" : " Calculator"}`,
    pageDescription: desc,
    primaryResultTitle: "Your Primary Result",
    proTip: "Stress-test assumptions and confirm quotes with your lender, attorney or advisor before deciding.",
    understanding: [
      { title: "Inputs", body: "Use realistic, conservative assumptions for your market and asset." },
      { title: "Results", body: "Outputs are estimates based on the formulas in this tool." },
      { title: "Compare", body: "Save scenarios when signed in to compare versions in your library." },
      { title: "Advice", body: "Not a substitute for personalised financial, legal or tax advice." }
    ],
    categoryId: findCategoryIdForSlug(slug)
  };
}

export function getCalculatorToolPageMeta(slug: string): CalculatorToolPageMeta {
  return { ...defaultMeta(slug), ...META[slug] };
}
