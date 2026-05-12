export type FieldType = "money" | "percent" | "number" | "select" | "checkbox" | "text";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
};

export type FieldGroup = {
  title: string;
  fields: FieldDef[];
};

export type CalculatorDef = {
  slug: string;
  name: string;
  description: string;
  groups: FieldGroup[];
};

const scenarioGroup: FieldGroup = {
  title: "Scenario",
  fields: [
    { key: "scenarioName", label: "Scenario name", type: "text", placeholder: "e.g. 2-bed townhouse in Cape Town", required: false }
  ]
};

export const calculators: CalculatorDef[] = [
  {
    slug: "transfer-bond-costs",
    name: "Transfer & Bond Costs (South Africa)",
    description:
      "Estimate transfer duty, conveyancer fees (incl. VAT), Deeds Office fees, municipal clearance provision and typical disbursements before registration.",
    groups: [
      scenarioGroup,
      {
        title: "Purchase",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money", required: true },
          {
            key: "marketValue",
            label: "Market / municipal value (optional, R)",
            type: "money",
            help: "If higher than the purchase price, transfer duty uses this value (fair value / consideration rule)."
          },
          { key: "bondAmount", label: "Bond amount (R)", type: "money", required: true, help: "Use 0 if no bond." },
          { key: "depositAmount", label: "Deposit (optional, R)", type: "money" }
        ]
      },
      {
        title: "Transaction",
        fields: [
          {
            key: "transactionType",
            label: "Transaction type",
            type: "select",
            required: true,
            options: [
              { label: "Transfer duty applies", value: "TRANSFER_DUTY" },
              { label: "VAT transaction (no transfer duty)", value: "VAT_TRANSACTION" }
            ]
          },
          {
            key: "buyerType",
            label: "Buyer",
            type: "select",
            required: true,
            options: [
              { label: "Individual", value: "INDIVIDUAL" },
              { label: "Company", value: "COMPANY" },
              { label: "Trust", value: "TRUST" }
            ]
          },
          { key: "includeBondRegistration", label: "Include bond registration costs", type: "checkbox" },
          { key: "sellerVatRegistered", label: "Seller is VAT registered (informational)", type: "checkbox" },
          {
            key: "propertyUse",
            label: "Property use",
            type: "select",
            options: [
              { label: "Primary residence", value: "PRIMARY_RESIDENCE" },
              { label: "Investment", value: "INVESTMENT" },
              { label: "Commercial", value: "COMMERCIAL" },
              { label: "Vacant land", value: "VACANT_LAND" },
              { label: "Other", value: "OTHER" }
            ]
          },
          { key: "province", label: "Province (optional)", type: "text", placeholder: "e.g. Western Cape" },
          { key: "municipality", label: "Municipality (optional)", type: "text", placeholder: "e.g. City of Cape Town" }
        ]
      },
      {
        title: "Fees & provisions",
        fields: [
          {
            key: "feeYear",
            label: "Deeds Office fee schedule",
            type: "select",
            required: true,
            options: [
              { label: "1 Apr 2026 – 28 Feb 2027 (default)", value: "2026_2027" },
              { label: "1 Apr 2025 – 28 Feb 2026", value: "2025_2026" }
            ]
          },
          {
            key: "attorneyFeeMode",
            label: "Conveyancer fee mode",
            type: "select",
            required: true,
            options: [
              { label: "Estimated (recommended tariff, ex VAT)", value: "ESTIMATE" },
              { label: "Manual (enter professional fees ex VAT)", value: "MANUAL" }
            ]
          },
          { key: "manualTransferAttorneyFee", label: "Manual transfer attorney fee (ex VAT, R)", type: "money" },
          { key: "manualBondAttorneyFee", label: "Manual bond attorney fee (ex VAT, R)", type: "money" },
          { key: "vatRate", label: "VAT rate on professional fees (%)", type: "percent" },
          { key: "municipalRatesClearanceProvision", label: "Municipal / rates clearance provision (R)", type: "money" },
          { key: "postagesAndPettiesEstimate", label: "Postages & petties (R)", type: "money" },
          { key: "ficaFeeEstimate", label: "FICA / compliance estimate (R)", type: "money" },
          { key: "deedsSearchFeeEstimate", label: "Deeds search fee estimate (R)", type: "money" },
          { key: "electronicInstructionFeeEstimate", label: "Electronic instruction fee estimate (R)", type: "money" }
        ]
      },
      {
        title: "Cash required",
        fields: [
          {
            key: "includeDepositInCashRequired",
            label: "Include deposit in “cash required including deposit”",
            type: "checkbox",
            help: "Deposit is not part of transfer/bond fees; only add it to that total when you want a combined cash figure."
          },
          { key: "isFirstTimeBuyer", label: "First-time buyer (informational only)", type: "checkbox" }
        ]
      }
    ]
  },
  {
    slug: "monthly-payment",
    name: "Monthly Bond Payment",
    description: "Calculate monthly repayment, total interest, and full amortisation schedule (with extra payments).",
    groups: [
      scenarioGroup,
      {
        title: "Loan details",
        fields: [
          { key: "purchasePrice", label: "Purchase price (optional, R)", type: "money" },
          { key: "depositAmount", label: "Deposit (R)", type: "money" },
          { key: "bondAmount", label: "Bond amount (leave blank to auto-calc)", type: "money" },
          { key: "annualInterestRate", label: "Annual interest rate (%)", type: "percent", required: true },
          {
            key: "loanTermYears",
            label: "Loan term (years)",
            type: "select",
            required: true,
            options: [
              { label: "10", value: 10 },
              { label: "15", value: 15 },
              { label: "20", value: 20 },
              { label: "25", value: 25 },
              { label: "30", value: 30 }
            ]
          }
        ]
      },
      {
        title: "Extra payments (optional)",
        fields: [
          { key: "extraMonthlyPayment", label: "Extra monthly payment (R)", type: "money" },
          { key: "onceOffExtraPayment", label: "Once-off extra payment (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "cash-flow",
    name: "Cash Flow",
    description: "See whether the property produces monthly positive or negative cash flow after vacancy, expenses and debt service.",
    groups: [
      scenarioGroup,
      {
        title: "Income",
        fields: [
          { key: "monthlyRent", label: "Monthly rent (R)", type: "money", required: true },
          { key: "otherMonthlyIncome", label: "Other monthly income (R)", type: "money" },
          { key: "annualRentGrowthPercent", label: "Annual rent growth (optional, %)", type: "percent" }
        ]
      },
      { title: "Vacancy", fields: [{ key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" }] },
      {
        title: "Operating expenses (monthly)",
        fields: [
          { key: "ratesAndTaxes", label: "Rates & taxes (R)", type: "money" },
          { key: "levies", label: "Levies (R)", type: "money" },
          { key: "insurance", label: "Insurance (R)", type: "money" },
          { key: "maintenance", label: "Maintenance (R)", type: "money" },
          { key: "propertyManagementPercent", label: "Property management (% of income)", type: "percent" },
          { key: "utilitiesPaidByOwner", label: "Utilities paid by owner (R)", type: "money" },
          { key: "accountingAdmin", label: "Accounting/admin (R)", type: "money" },
          { key: "otherExpenses", label: "Other expenses (R)", type: "money" }
        ]
      },
      { title: "Debt service", fields: [{ key: "monthlyBondPayment", label: "Monthly bond payment (R)", type: "money" }] }
    ]
  },
  {
    slug: "cash-on-cash-return",
    name: "Cash-on-Cash ROI",
    description: "Annual pre-tax cash flow divided by total cash invested (deposit + costs + repairs + etc.).",
    groups: [
      scenarioGroup,
      {
        title: "Cash invested",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "depositAmount", label: "Deposit (R)", type: "money" },
          { key: "transferAndBondCosts", label: "Transfer & bond costs (R)", type: "money" },
          { key: "initialRepairs", label: "Initial repairs (R)", type: "money" },
          { key: "furnishingCosts", label: "Furnishing (R)", type: "money" },
          { key: "otherAcquisitionCosts", label: "Other acquisition costs (R)", type: "money" }
        ]
      },
      {
        title: "Cash flow",
        fields: [
          { key: "annualCashFlow", label: "Annual cash flow (R) (optional)", type: "money", help: "If you don’t know it, leave blank and fill in the cash-flow inputs below." },
          { key: "monthlyRent", label: "Monthly rent (R)", type: "money" },
          { key: "otherMonthlyIncome", label: "Other monthly income (R)", type: "money" },
          { key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" },
          { key: "monthlyOperatingExpenses", label: "Monthly operating expenses (R)", type: "money" },
          { key: "monthlyDebtService", label: "Monthly debt service (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "noi",
    name: "Net Operating Income (NOI)",
    description: "Income before financing and tax. Excludes bond repayment, tax, depreciation and capital improvements.",
    /** Inputs are rendered in `CalculatorPage` (annual rent, line-item opex, vacancy & maintenance %). */
    groups: [scenarioGroup]
  },
  {
    slug: "cap-rate",
    name: "Cap Rate",
    description: "Compare property yield independent of financing: annual NOI / property value.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "propertyValue", label: "Property value (R)", type: "money" },
          { key: "annualNOI", label: "Annual NOI (R)", type: "money" },
          { key: "targetCapRatePercent", label: "Target cap rate (%)", type: "percent" }
        ]
      }
    ]
  },
  {
    slug: "dscr",
    name: "DSCR",
    description: "Debt Service Coverage Ratio: annual NOI / annual debt service.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "annualNOI", label: "Annual NOI (R)", type: "money" },
          { key: "monthlyBondPayment", label: "Monthly bond payment (R) (optional)", type: "money" },
          { key: "annualDebtService", label: "Annual debt service (R) (optional)", type: "money", help: "If blank, we’ll calculate it from monthly bond payment." }
        ]
      }
    ]
  },
  {
    slug: "irr",
    name: "IRR",
    description:
      "Annualised discount rate r where NPV = CF₀ + CF₁/(1+r)¹ + ⋯ + CFₙ/(1+r)ⁿ = 0. Use legacy mode (sale price + annual flows) or growth mode (current value × appreciation + bond).",
    groups: [
      scenarioGroup,
      {
        title: "Growth mode (optional)",
        fields: [
          {
            key: "totalCashInvested",
            label: "Total cash invested (R)",
            type: "money",
            help: "If set with current estimated value, exit value = value × (1+appreciation)ᴴ and CF₀ = −this amount."
          },
          { key: "currentEstimatedValue", label: "Current estimated value (R)", type: "money" },
          { key: "annualCashFlowAfterExpensesAndDebt", label: "Annual net cash flow after debt (R)", type: "money" },
          { key: "outstandingBondBalance", label: "Outstanding bond balance (R)", type: "money" },
          { key: "expectedAnnualAppreciationPercent", label: "Expected annual appreciation (%)", type: "percent" },
          { key: "estimatedSellingCostPercent", label: "Selling costs at exit (%)", type: "percent" },
          { key: "projectedBondBalanceAtSale", label: "Projected bond at sale (R) (optional)", type: "money" },
          { key: "cashFlowGrowthPercentAnnual", label: "Annual growth on net cash flow (%)", type: "percent" }
        ]
      },
      {
        title: "Legacy: hold period & cash flows",
        fields: [
          { key: "initialCashInvested", label: "Initial cash invested (negative, R)", type: "money" },
          { key: "holdPeriodYears", label: "Hold period (years)", type: "number", required: true },
          { key: "annualCashFlows", label: "Annual cash flows (comma-separated, R)", type: "text", help: "Example: 12000, 14000, 16000 or a single value repeated." }
        ]
      },
      {
        title: "Legacy: exit",
        fields: [
          { key: "expectedSalePrice", label: "Expected sale price (R)", type: "money" },
          { key: "sellingCostsPercent", label: "Selling costs (%)", type: "percent" },
          { key: "remainingLoanBalanceAtSale", label: "Remaining loan balance at sale (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "brrrr",
    name: "BRRRR",
    description: "Buy, Renovate, Rent, Refinance, Repeat analysis.",
    groups: [
      scenarioGroup,
      {
        title: "Project costs",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "rehabCost", label: "Rehab cost (R)", type: "money" },
          { key: "transferAndBondCosts", label: "Transfer & bond costs (R)", type: "money" }
        ]
      },
      {
        title: "Refinance",
        fields: [
          { key: "afterRepairValue", label: "After repair value (ARV) (R)", type: "money" },
          { key: "refinanceLTVPercent", label: "Refinance LTV (%)", type: "percent" },
          { key: "originalLoanPayoff", label: "Original loan payoff (R)", type: "money" },
          { key: "newInterestRate", label: "New interest rate (%)", type: "percent" },
          {
            key: "loanTermYears",
            label: "New loan term (years)",
            type: "select",
            options: [
              { label: "10", value: 10 },
              { label: "15", value: 15 },
              { label: "20", value: 20 },
              { label: "25", value: 25 },
              { label: "30", value: 30 }
            ]
          }
        ]
      },
      {
        title: "Rental (post-refi)",
        fields: [
          { key: "rentMonthly", label: "Monthly rent (R)", type: "money" },
          { key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" },
          { key: "monthlyOperatingExpenses", label: "Monthly operating expenses (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "short-term-rental",
    name: "Airbnb / Short-term rental",
    description: "Analyse short-term rental income, fees, and net cash flow.",
    groups: [
      scenarioGroup,
      {
        title: "Revenue",
        fields: [
          { key: "averageDailyRate", label: "Average daily rate (R)", type: "money" },
          { key: "occupancyRatePercent", label: "Occupancy rate (%)", type: "percent" },
          { key: "availableNightsPerMonth", label: "Available nights per month", type: "number" },
          { key: "cleaningFeePerStay", label: "Cleaning fee per stay (R)", type: "money" },
          { key: "averageStayLength", label: "Average stay length (nights)", type: "number" }
        ]
      },
      {
        title: "Fees & expenses",
        fields: [
          { key: "platformFeePercent", label: "Platform fee (%)", type: "percent" },
          { key: "managementFeePercent", label: "Management fee (%)", type: "percent" },
          { key: "suppliesMonthly", label: "Supplies (monthly, R)", type: "money" },
          { key: "utilitiesMonthly", label: "Utilities (monthly, R)", type: "money" },
          { key: "insuranceMonthly", label: "Insurance (monthly, R)", type: "money" },
          { key: "ratesAndTaxesMonthly", label: "Rates & taxes (monthly, R)", type: "money" },
          { key: "maintenanceMonthly", label: "Maintenance (monthly, R)", type: "money" },
          { key: "monthlyDebtService", label: "Debt service (monthly, R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "70-rule",
    name: "70% Rule",
    description: "Estimate maximum offer for a flip using the 70% rule and a custom cost/profit model.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "afterRepairValue", label: "After repair value (ARV) (R)", type: "money" },
          { key: "estimatedRepairCost", label: "Estimated repair cost (R)", type: "money" },
          { key: "desiredProfitMargin", label: "Desired profit margin (%)", type: "percent" },
          { key: "sellingCosts", label: "Selling costs (R)", type: "money" },
          { key: "holdingCosts", label: "Holding costs (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "flip-profit",
    name: "Flip Profit",
    description: "Calculate expected profit, ROI and break-even sale price for a flip.",
    groups: [
      scenarioGroup,
      {
        title: "Costs",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "rehabCost", label: "Rehab cost (R)", type: "money" },
          { key: "holdingCosts", label: "Holding costs (R)", type: "money" },
          { key: "transferCosts", label: "Transfer costs (R)", type: "money" },
          { key: "financingCosts", label: "Financing costs (R)", type: "money" },
          { key: "contingencyPercent", label: "Contingency (%)", type: "percent" }
        ]
      },
      {
        title: "Sale",
        fields: [
          { key: "sellingPrice", label: "Selling price (R)", type: "money" },
          { key: "sellingAgentCommissionPercent", label: "Agent commission (%)", type: "percent" }
        ]
      }
    ]
  },
  {
    slug: "wholesale-profit",
    name: "Wholesale Profit",
    description: "Estimate buyer max offer and your max contract price after assignment fee.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "afterRepairValue", label: "After repair value (ARV) (R)", type: "money" },
          { key: "repairCost", label: "Repair cost (R)", type: "money" },
          { key: "desiredInvestorProfit", label: "Desired investor profit (R)", type: "money" },
          { key: "assignmentFee", label: "Assignment fee (R)", type: "money" },
          { key: "buyerMaxOfferPercent", label: "Buyer max offer % of ARV", type: "percent" }
        ]
      }
    ]
  },
  {
    slug: "rehab-cost",
    name: "Rehab Estimator",
    description: "Estimate renovation budget from line items and contingency.",
    groups: [
      scenarioGroup,
      {
        title: "Rehab",
        fields: [
          { key: "contingencyPercent", label: "Contingency (%)", type: "percent" },
          { key: "items", label: "Line items (JSON)", type: "text", help: "For now, enter JSON array: [{\"category\":\"kitchen\",\"description\":\"Counters\",\"quantity\":1,\"unitCost\":20000}]" }
        ]
      }
    ]
  },
  {
    slug: "rent-to-cost-ratio",
    name: "Rent-to-Cost Ratio",
    description: "Quick screening metric comparing rent to price (1% and 2% rules).",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "monthlyRent", label: "Monthly rent (R)", type: "money" },
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "initialRepairCost", label: "Initial repair cost (optional, R)", type: "money" },
          { key: "totalAcquisitionCost", label: "Total acquisition cost (optional, R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "grm",
    name: "Gross Rent Multiplier (GRM)",
    description: "Quick valuation metric based on gross rent (ignores expenses and financing).",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "monthlyGrossRent", label: "Monthly gross rent (R)", type: "money" },
          { key: "targetGRM", label: "Target GRM", type: "number" }
        ]
      }
    ]
  },
  {
    slug: "ltv",
    name: "Loan-to-Value (LTV)",
    description: "Measure leverage and equity: loan amount / property value.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "propertyValue", label: "Property value (R)", type: "money" },
          { key: "loanAmount", label: "Loan amount (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "dcf",
    name: "Discounted Cash Flow (DCF)",
    description: "Estimate today’s value of future cash flows and compute NPV at a chosen discount rate.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "initialInvestment", label: "Initial investment (R)", type: "money" },
          { key: "discountRatePercent", label: "Discount rate (%)", type: "percent" },
          { key: "annualCashFlows", label: "Annual cash flows (comma-separated, R)", type: "text" },
          { key: "salePriceAtEnd", label: "Sale price at end (R)", type: "money" },
          { key: "sellingCosts", label: "Selling costs (R)", type: "money" },
          { key: "holdPeriodYears", label: "Hold period (years)", type: "number" }
        ]
      }
    ]
  },
  {
    slug: "operating-expense-ratio",
    name: "Operating Expense Ratio",
    description: "Total operating expenses divided by gross income.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "annualOperatingExpenses", label: "Annual operating expenses (R)", type: "money" },
          { key: "annualGrossIncome", label: "Annual gross income (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "square-footage",
    name: "Square Footage / Area",
    description: "Compute area in square metres and feet (plus definitions).",
    groups: [
      scenarioGroup,
      { title: "Inputs", fields: [{ key: "length", label: "Length (m)", type: "number" }, { key: "width", label: "Width (m)", type: "number" }] }
    ]
  }
];
