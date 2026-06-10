import type { CalculatorDef } from "./calculators";

/** Presentation-only: which inputs show as core vs advanced assumptions per calculator slug. */
const FIELD_LAYOUT: Partial<Record<string, { core: string[]; advanced: string[] }>> = {
  "monthly-payment": {
    core: ["bondAmount", "loanTermYears", "annualInterestRate"],
    advanced: ["purchasePrice", "depositAmount", "extraMonthlyPayment", "onceOffExtraPayment", "scenarioName"]
  },
  "buy-vs-rent": {
    core: ["purchasePrice", "monthlyRent", "depositAmount", "interestRate", "analysisYears", "propertyAppreciation"],
    advanced: ["rentEscalation"]
  },
  "transfer-bond-costs": {
    core: [
      "purchasePrice",
      "bondAmount",
      "depositAmount",
      "transactionType",
      "buyerType",
      "includeBondRegistration",
      "feeYear"
    ],
    advanced: [
      "marketValue",
      "sellerVatRegistered",
      "propertyUse",
      "province",
      "municipality",
      "attorneyFeeMode",
      "manualTransferAttorneyFee",
      "manualBondAttorneyFee",
      "vatRate",
      "municipalRatesClearanceProvision",
      "postagesAndPettiesEstimate",
      "ficaFeeEstimate",
      "deedsSearchFeeEstimate",
      "electronicInstructionFeeEstimate",
      "includeDepositInCashRequired",
      "isFirstTimeBuyer",
      "scenarioName"
    ]
  },
  "cash-flow": {
    core: [
      "monthlyRent",
      "bondAmount",
      "maintenance",
      "ratesAndTaxes",
      "vacancyRatePercent",
      "propertyManagementPercent"
    ],
    advanced: [
      "annualInterestRate",
      "loanTermYears",
      "levies",
      "insurance",
      "otherMonthlyIncome",
      "annualRentGrowthPercent",
      "utilitiesPaidByOwner",
      "accountingAdmin",
      "otherExpenses",
      "scenarioName"
    ]
  },
  "cash-on-cash-return": {
    core: [
      "purchasePrice",
      "depositAmount",
      "transferAndBondCosts",
      "monthlyRent",
      "vacancyRatePercent",
      "monthlyOperatingExpenses",
      "monthlyDebtService",
      "holdPeriodYears"
    ],
    advanced: [
      "initialRepairs",
      "furnishingCosts",
      "otherAcquisitionCosts",
      "annualCashFlow",
      "otherMonthlyIncome",
      "cashFlowGrowthPercentAnnual",
      "scenarioName"
    ]
  },
  "cap-rate": {
    core: ["propertyValue", "annualNOI", "targetCapRatePercent"],
    advanced: ["scenarioName"]
  },
  dscr: {
    core: ["annualNOI", "monthlyBondPayment", "annualDebtService"],
    advanced: ["scenarioName"]
  },
  irr: {
    core: [
      "totalCashInvested",
      "currentEstimatedValue",
      "annualCashFlowAfterExpensesAndDebt",
      "holdPeriodYears",
      "expectedAnnualAppreciationPercent",
      "initialCashInvested",
      "annualCashFlows"
    ],
    advanced: [
      "outstandingBondBalance",
      "outstandingBondInterestRatePercent",
      "bondTermYears",
      "estimatedSellingCostPercent",
      "projectedBondBalanceAtSale",
      "cashFlowGrowthPercentAnnual",
      "expectedSalePrice",
      "remainingLoanBalanceAtSale",
      "scenarioName"
    ]
  },
  dcf: {
    core: ["initialInvestment", "discountRatePercent", "annualCashFlows", "salePriceAtEnd", "holdPeriodYears"],
    advanced: ["sellingCosts", "scenarioName"]
  },
  brrrr: {
    core: [
      "purchasePrice",
      "rehabCost",
      "afterRepairValue",
      "refinanceLTVPercent",
      "rentMonthly",
      "loanTermYears",
      "newInterestRate"
    ],
    advanced: [
      "transferAndBondCosts",
      "originalLoanPayoff",
      "vacancyRatePercent",
      "monthlyOperatingExpenses",
      "scenarioName"
    ]
  },
  "short-term-rental": {
    core: [
      "averageDailyRate",
      "occupancyRatePercent",
      "availableNightsPerMonth",
      "platformFeePercent",
      "managementFeePercent",
      "maintenanceMonthly",
      "monthlyDebtService"
    ],
    advanced: [
      "cleaningFeePerStay",
      "averageStayLength",
      "suppliesMonthly",
      "utilitiesMonthly",
      "insuranceMonthly",
      "ratesAndTaxesMonthly",
      "scenarioName"
    ]
  },
  "70-rule": {
    core: ["afterRepairValue", "estimatedRepairCost", "desiredProfitMargin", "sellingCosts", "holdingCosts"],
    advanced: ["scenarioName"]
  },
  "flip-profit": {
    core: ["purchasePrice", "rehabCost", "sellingPrice", "holdingCosts", "sellingAgentCommissionPercent"],
    advanced: [
      "transferCosts",
      "financingCosts",
      "contingencyPercent",
      "scenarioName"
    ]
  },
  "wholesale-profit": {
    core: ["afterRepairValue", "repairCost", "assignmentFee", "desiredInvestorProfit", "buyerMaxOfferPercent"],
    advanced: ["scenarioName"]
  },
  "rehab-cost": {
    core: ["items", "contingencyPercent"],
    advanced: ["scenarioName"]
  },
  "rent-to-cost-ratio": {
    core: ["monthlyRent", "purchasePrice", "totalAcquisitionCost"],
    advanced: ["initialRepairCost", "scenarioName"]
  },
  grm: {
    core: ["purchasePrice", "monthlyGrossRent"],
    advanced: ["scenarioName"]
  },
  ltv: {
    core: ["propertyValue", "loanAmount"],
    advanced: ["scenarioName"]
  },
  "operating-expense-ratio": {
    core: ["annualOperatingExpenses", "annualGrossIncome"],
    advanced: ["scenarioName"]
  },
  "square-footage": {
    core: ["length", "width"],
    advanced: ["scenarioName"]
  },
  "gross-yield": {
    core: ["purchasePrice", "monthlyGrossRent"],
    advanced: ["otherMonthlyIncome", "scenarioName"]
  },
  "yield-on-cost": {
    core: ["stabilisedNOI", "totalProjectCost"],
    advanced: ["scenarioName"]
  },
  "debt-yield": {
    core: ["annualNOI", "loanAmount"],
    advanced: ["scenarioName"]
  },
  "break-even-occupancy": {
    core: ["grossPotentialIncomeAnnual", "annualOperatingExpenses", "annualDebtService"],
    advanced: ["scenarioName"]
  },
  "loan-constant": {
    core: ["loanAmount", "monthlyBondPayment", "annualDebtService"],
    advanced: ["scenarioName"]
  }
};

const SCENARIO_KEY = "scenarioName";
const MAX_CORE = 7;

export type CalculatorFieldLayout = {
  core: string[];
  advanced: string[];
};

export function flattenCalculatorFieldKeys(calc: CalculatorDef): string[] {
  return calc.groups.flatMap((g) => g.fields.map((f) => f.key));
}

export function getCalculatorFieldLayout(slug: string, calc: CalculatorDef): CalculatorFieldLayout {
  const allKeys = flattenCalculatorFieldKeys(calc);
  const explicit = FIELD_LAYOUT[slug];

  if (explicit) {
    return {
      core: explicit.core.filter((k) => allKeys.includes(k)),
      advanced: explicit.advanced.filter((k) => allKeys.includes(k))
    };
  }

  const rest = allKeys.filter((k) => k !== SCENARIO_KEY);
  if (rest.length <= MAX_CORE) {
    return {
      core: rest,
      advanced: allKeys.includes(SCENARIO_KEY) ? [SCENARIO_KEY] : []
    };
  }
  return {
    core: rest.slice(0, MAX_CORE),
    advanced: [...rest.slice(MAX_CORE), ...(allKeys.includes(SCENARIO_KEY) ? [SCENARIO_KEY] : [])]
  };
}

export function getCalculatedFieldHint(
  slug: string,
  fieldKey: string,
  values: Record<string, unknown>
): string | undefined {
  if (slug === "monthly-payment" && fieldKey === "bondAmount") {
    const price = Number(values.purchasePrice);
    const deposit = Number(values.depositAmount) || 0;
    if (Number.isFinite(price) && price > 0 && !values.bondAmount) {
      return "Calculated as property price minus deposit when left blank.";
    }
  }
  if (slug === "ltv" && fieldKey === "loanAmount") {
    const value = Number(values.propertyValue);
    const loan = Number(values.loanAmount);
    if (Number.isFinite(value) && value > 0 && Number.isFinite(loan)) {
      return undefined;
    }
  }
  return undefined;
}

export function isCalculatedFieldDisplay(slug: string, fieldKey: string, values: Record<string, unknown>): boolean {
  if (slug === "monthly-payment" && fieldKey === "bondAmount") {
    const price = Number(values.purchasePrice);
    const deposit = Number(values.depositAmount) || 0;
    return Number.isFinite(price) && price > 0 && (values.bondAmount === "" || values.bondAmount == null);
  }
  return false;
}
