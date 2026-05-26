/** Light-band copy: how to use the tool, plus balanced pros/cons (not financial advice). */

export type CalculatorToolExplainer = {
  usageExplained: string;
  advantages: string[];
  disadvantages: string[];
};

const GENERIC_ADV: string[] = [
  "Structured fields and instant results help you compare scenarios quickly.",
  "Useful as a first-pass screen before deeper underwriting or professional quotes."
];

const GENERIC_DIS: string[] = [
  "Uses simplifying assumptions that may not match your bank, municipality or tax position.",
  "Does not replace legal, tax, lending or investment advice tailored to your situation."
];

export const CALCULATOR_TOOL_EXPLAINER: Partial<Record<string, CalculatorToolExplainer>> = {
  "transfer-bond-costs": {
    usageExplained:
      "Use this tool when you are budgeting cash to register — transfer duty (where applicable), conveyancing and bond registration lines are estimated from typical South African tariffs and schedules.",
    advantages: [
      "Surfaces major line items buyers often forget until attorney quotes arrive.",
      "Lets you toggle bond registration and deposit treatment to match how you are structuring the deal."
    ],
    disadvantages: [
      "Actual invoices vary by firm, bank add-ons and property-specific searches.",
      "VAT vs transfer-duty treatment must be confirmed on the specific transaction."
    ]
  },
  "buy-vs-rent": {
    usageExplained:
      "Enter property price, rent, deposit, bond rate, how long you will stay, and expected property and rent growth. Upfront transfer duty and bond registration use the same SARS brackets and fee tables as the Transfer & Bond Costs calculator; bond repayment, ownership costs, selling costs at exit, and rent-plus-invest paths run in the background — expand Assumptions used below the results for detail.",
    advantages: [
      "Only a handful of inputs — designed for a quick first-pass decision, not a full underwriting model.",
      "Plain-English conclusion plus charts for monthly cost and wealth position over time.",
      "Useful when weighing a primary home or a long-term rental before speaking to a bank or agent."
    ],
    disadvantages: [
      "Background assumptions (investment return, maintenance, selling costs, etc.) are fixed — your market may differ.",
      "Does not model income tax, levy shocks, or moving mid-period.",
      "Not a substitute for personalised financial, legal or lending advice."
    ]
  },
  "monthly-payment": {
    usageExplained:
      "Use this bond repayment view to see monthly instalments, total interest and how extra payments shorten the term before you fix an offer or refinance.",
    advantages: [
      "Shows principal vs interest over time so you can sense total cost of leverage.",
      "Extra-payment fields help stress-test paying down faster."
    ],
    disadvantages: [
      "Assumes a constant rate over the term; real products may reprice or include fees.",
      "Excludes insurance, bank charges and life policy requirements that lenders may impose."
    ]
  },
  "cash-flow": {
    usageExplained:
      "Model monthly rent, vacancy, operating costs and debt service to see whether the property is likely to be cash-flow positive on your assumptions.",
    advantages: [
      "Forces a disciplined view of recurring costs alongside financing.",
      "Good for comparing similar rentals with different levies, rates and bond structures."
    ],
    disadvantages: [
      "One-period view — does not replace a multi-year cash forecast or tax modelling.",
      "Maintenance and vacancy are highly property-specific; defaults can mislead if left unchecked."
    ]
  },
  "cash-on-cash-return": {
    usageExplained:
      "Compare annual pre-tax cash flow to total cash invested to judge whether the yield on equity meets your hurdle before you allocate capital.",
    advantages: [
      "Simple investor headline metric that travels well across deals.",
      "Highlights how leverage and upfront costs change returns on equity."
    ],
    disadvantages: [
      "Ignores principal paydown, tax and time value of money.",
      "A high CoC with thin liquidity can still be fragile if assumptions slip."
    ]
  },
  noi: {
    usageExplained:
      "Calculate net operating income after vacancy and operating expenses — before bond payments — to feed cap rate, DSCR and valuation-style screens.",
    advantages: [
      "Separates operating performance from financing, which lenders and buyers both care about.",
      "Line-item expenses help you check completeness versus your rent roll."
    ],
    disadvantages: [
      "Growth and vacancy are stylised; real leases step and turn over unevenly.",
      "Excludes capex, tenant improvements and once-off items that can dominate some years."
    ]
  },
  "cap-rate": {
    usageExplained:
      "Divide annual NOI by price (or value) to rank deals on a normalised yield before layering in your financing and tax view.",
    advantages: [
      "Fast, comparable metric across assets with similar risk profiles.",
      "Pairs cleanly with NOI from this site’s other tools."
    ],
    disadvantages: [
      "Ignores financing, growth, capex and exit — two equal cap rates can imply very different risk.",
      "Sensitive to how NOI is normalised; incomplete expenses inflate the cap."
    ]
  },
  dscr: {
    usageExplained:
      "Stress-test whether net operating income comfortably covers annual debt service — a common lender and conservative-investor lens.",
    advantages: [
      "Translates income stability into a simple coverage ratio.",
      "Useful when interest rates or bond payments move and you need a quick recheck."
    ],
    disadvantages: [
      "Does not model covenant baskets, interest-only periods or reserve accounts.",
      "A pass today can fail tomorrow if income or expenses shift sharply."
    ]
  },
  irr: {
    usageExplained:
      "Solve for the discount rate that sets the net present value of your cash flows (including exit) to zero — a time-weighted view of return on cash.",
    advantages: [
      "Captures timing of money in and out, unlike simple cash multiples.",
      "Helpful when comparing holds with different shapes of cash flow."
    ],
    disadvantages: [
      "Sensitive to reinvestment assumptions and exit timing; small input changes move IRR a lot.",
      "Multiple IRRs can appear on non-conventional cash-flow paths — interpret carefully."
    ]
  },
  brrrr: {
    usageExplained:
      "Sketch buy–rehab–rent–refinance: forced equity, refinance LTV and cash left in the deal after you stabilise rent and reset the loan.",
    advantages: [
      "Makes the capital recycle explicit before you commit to a rehab-heavy strategy.",
      "Links operating income to refinance capacity in one narrative."
    ],
    disadvantages: [
      "Refinance values and timelines are uncertain; model is illustrative only.",
      "Rehab overruns and letting delays are often where real BRRRR plans break."
    ]
  },
  "short-term-rental": {
    usageExplained:
      "Estimate short-stay gross revenue from ADR and occupancy, then net off platform fees, operating costs and debt to sense monthly cash potential.",
    advantages: [
      "Brings STR revenue drivers into one quick monthly picture.",
      "Helps contrast against long-term letting on the same asset."
    ],
    disadvantages: [
      "Regulation, seasonality and competition swing outcomes — static inputs hide volatility.",
      "Platform fee stacks and cleaning costs vary materially by market and operator."
    ]
  },
  "70-rule": {
    usageExplained:
      "Apply a classic flip screening rule (max offer vs ARV and repairs) to discard bad deals fast before you spend time on full underwriting.",
    advantages: [
      "Very fast triage when you are scanning many listings.",
      "Keeps a visible profit margin line in the arithmetic."
    ],
    disadvantages: [
      "Markets where margins are thin will reject almost everything — the rule is not universal.",
      "Ignores financing cost, holding time and tax — not a substitute for a full flip model."
    ]
  },
  "flip-profit": {
    usageExplained:
      "Build purchase, rehab, holding and sale lines to estimate profit, margin and a break-even resale price on a fix-and-flip style project.",
    advantages: [
      "Surfaces how holding costs and selling fees erode headline uplift.",
      "Break-even sale price is a useful stress anchor when bids move."
    ],
    disadvantages: [
      "Rehab duration and sale timing are uncertain — model is static.",
      "Tax (CGT, VAT) and structuring choices are not fully captured here."
    ]
  },
  "wholesale-profit": {
    usageExplained:
      "Check whether there is enough spread between your contract price, the buyer’s max offer and your assignment fee for a wholesale-style deal.",
    advantages: [
      "Makes the fee vs repair-margin trade-off explicit in one pass.",
      "Good for quick partner conversations on whether a contract is assignable at a profit."
    ],
    disadvantages: [
      "Assumes you can actually assign and close — legal and reputational constraints vary.",
      "Buyer repair estimates may differ; thin spreads vanish quickly."
    ]
  },
  "rehab-cost": {
    usageExplained:
      "Roll up line-item rehab costs with contingency to feed flip, BRRRR or purchase budgeting with a clearer view of where money goes.",
    advantages: [
      "Forces a checklist mindset instead of a single lump-sum guess.",
      "Contingency line reminds you that unknowns are normal in refurb work."
    ],
    disadvantages: [
      "Does not schedule cash outflows over months — timing risk remains.",
      "Scope creep and contractor variation are not captured beyond contingency %."
    ]
  },
  "rent-to-cost-ratio": {
    usageExplained:
      "Compare monthly rent to purchase price (and optionally total acquisition) to screen deals with simple rent-to-price heuristics.",
    advantages: [
      "Extremely quick sanity check when you are ranking many addresses.",
      "Pairs well with GRM and cap-rate tools for layered screening."
    ],
    disadvantages: [
      "Ignores operating expenses, vacancy and financing — high rent-to-price can still be a bad deal.",
      "Different markets have different norms; context matters more than the headline ratio."
    ]
  },
  grm: {
    usageExplained:
      "Divide price by gross annual rent to rank assets with a coarse multiplier — useful when expenses data is still thin.",
    advantages: [
      "Very fast when you only trust top-line rent at first glance.",
      "Comparable across similar micro-markets with similar expense structures."
    ],
    disadvantages: [
      "Completely ignores operating costs, vacancy and capex — misleading across building types.",
      "Gross rent quality (lease strength, escalations) is not reflected."
    ]
  },
  ltv: {
    usageExplained:
      "Relate loan size to property value to see leverage, equity cushion and headroom before you negotiate price or refinance terms.",
    advantages: [
      "Simple ratio that aligns with how lenders and risk managers speak.",
      "Pairs naturally with bond repayment and transfer-cost tools."
    ],
    disadvantages: [
      "Value input may be stale or subjective — garbage in, garbage out.",
      "Does not capture affordability on income (see DSCR) or liquidity after costs."
    ]
  },
  dcf: {
    usageExplained:
      "Discount projected annual cash flows plus exit proceeds at your hurdle rate to estimate net present value and whether the deal clears your required return.",
    advantages: [
      "Brings time value of money into the picture versus static multiples.",
      "Useful when exit timing and growth assumptions materially affect attractiveness."
    ],
    disadvantages: [
      "Highly sensitive to discount rate and terminal assumptions — small changes swing NPV.",
      "Garbage forecasts produce precise-looking nonsense; discipline on inputs is essential."
    ]
  },
  "operating-expense-ratio": {
    usageExplained:
      "Divide operating expenses by gross income to see how much revenue is consumed by running the building before debt and tax.",
    advantages: [
      "Highlights whether you are under-provisioning levies, repairs or management.",
      "Comparable across similar assets with honest income lines."
    ],
    disadvantages: [
      "Definition of “operating” varies — inconsistent buckets distort comparisons.",
      "A low ratio is not always good if maintenance has been deferred."
    ]
  },
  "square-footage": {
    usageExplained:
      "Convert between square metres and square feet from simple dimensions — handy for comparing listings, levies quoted per m², or rough build scope.",
    advantages: [
      "Removes mental conversion errors when sources mix imperial and metric.",
      "Quick sanity check when rates or rents are quoted per area unit."
    ],
    disadvantages: [
      "Assumes rectangular areas — odd shapes need measured plans.",
      "Does not validate actual registered floor area or municipal records."
    ]
  }
};

export function getToolExplainer(slug: string, description: string): CalculatorToolExplainer {
  const hit = CALCULATOR_TOOL_EXPLAINER[slug];
  if (hit) return hit;
  return {
    usageExplained: description,
    advantages: GENERIC_ADV,
    disadvantages: GENERIC_DIS
  };
}
