/**
 * Pre-filled values when opening a calculator route.
 * Keep aligned with backend Zod schemas in `backend/src/utils/calculatorEngine.ts`.
 */

export const TRANSFER_BOND_DEFAULTS: Record<string, unknown> = {
  transactionType: "TRANSFER_DUTY",
  buyerType: "INDIVIDUAL",
  propertyUse: "INVESTMENT",
  includeBondRegistration: true,
  includeDepositInCashRequired: false,
  sellerVatRegistered: false,
  isFirstTimeBuyer: false,
  feeYear: "2026_2027",
  attorneyFeeMode: "ESTIMATE",
  vatRate: 15,
  municipalRatesClearanceProvision: 7500,
  postagesAndPettiesEstimate: 1200,
  ficaFeeEstimate: 850,
  deedsSearchFeeEstimate: 500,
  electronicInstructionFeeEstimate: 650,
  purchasePrice: 2_300_000,
  bondAmount: 1_840_000,
  depositAmount: 460_000
};

const REHAB_ITEMS_JSON = `[{"category":"kitchen","description":"Counters & cupboards","quantity":1,"unitCost":45000},{"category":"bathroom","description":"Retile & fixtures","quantity":1,"unitCost":32000},{"category":"general","description":"Paint & preparation","quantity":1,"unitCost":28000}]`;

/** Defaults keyed by calculator slug (see `calculators.ts`). */
export const CALCULATOR_DEFAULT_VALUES: Record<string, Record<string, unknown>> = {
  "transfer-bond-costs": { ...TRANSFER_BOND_DEFAULTS },
  "monthly-payment": {
    purchasePrice: 2_300_000,
    depositAmount: 230_000,
    annualInterestRate: 11.25,
    loanTermYears: 30
  },
  "cash-flow": {
    monthlyRent: 18_500,
    otherMonthlyIncome: 0,
    annualRentGrowthPercent: 4,
    vacancyRatePercent: 6,
    ratesAndTaxes: 2_200,
    levies: 1_800,
    insurance: 650,
    maintenance: 950,
    propertyManagementPercent: 8,
    utilitiesPaidByOwner: 0,
    accountingAdmin: 0,
    otherExpenses: 0,
    monthlyBondPayment: 14_500
  },
  "cash-on-cash-return": {
    purchasePrice: 2_300_000,
    depositAmount: 345_000,
    transferAndBondCosts: 95_000,
    initialRepairs: 25_000,
    furnishingCosts: 15_000,
    otherAcquisitionCosts: 5_000,
    monthlyRent: 18_500,
    otherMonthlyIncome: 0,
    vacancyRatePercent: 6,
    monthlyOperatingExpenses: 3_800,
    monthlyDebtService: 14_500
  },
  noi: {
    rentalIncomeAnnual: 252_000,
    otherIncomeAnnual: 0,
    vacancyRatePercent: 5,
    maintenancePercentOfEffectiveGross: 5,
    rentGrowthPercentAnnual: 3,
    expenseGrowthPercentAnnual: 3,
    expenseItems: [
      { label: "Rates & taxes", annualAmount: 26_400 },
      { label: "Levies", annualAmount: 21_600 },
      { label: "Insurance", annualAmount: 7_800 },
      { label: "Property management", annualAmount: 6_000 },
      { label: "Utilities", annualAmount: 2_400 },
      { label: "Admin & other", annualAmount: 31_730 }
    ]
  },
  "cap-rate": {
    propertyValue: 2_300_000,
    annualNOI: 210_000,
    targetCapRatePercent: 8
  },
  dscr: {
    annualNOI: 210_000,
    monthlyBondPayment: 15_000
  },
  irr: {
    holdPeriodYears: 7,
    sellingCostsPercent: 5,
    totalCashInvested: 460_000,
    currentEstimatedValue: 2_300_000,
    annualCashFlowAfterExpensesAndDebt: 72_000,
    outstandingBondBalance: 1_760_000,
    expectedAnnualAppreciationPercent: 3.5,
    estimatedSellingCostPercent: 5.5,
    cashFlowGrowthPercentAnnual: 2
  },
  brrrr: {
    purchasePrice: 1_650_000,
    rehabCost: 220_000,
    transferAndBondCosts: 85_000,
    afterRepairValue: 2_400_000,
    refinanceLTVPercent: 75,
    originalLoanPayoff: 1_320_000,
    rentMonthly: 18_500,
    vacancyRatePercent: 5,
    monthlyOperatingExpenses: 4_200,
    newInterestRate: 11.25,
    loanTermYears: 20
  },
  "short-term-rental": {
    averageDailyRate: 950,
    occupancyRatePercent: 62,
    availableNightsPerMonth: 30,
    cleaningFeePerStay: 450,
    averageStayLength: 3,
    platformFeePercent: 15,
    managementFeePercent: 12,
    suppliesMonthly: 800,
    utilitiesMonthly: 900,
    insuranceMonthly: 450,
    ratesAndTaxesMonthly: 2_800,
    maintenanceMonthly: 650,
    monthlyDebtService: 12_500
  },
  "70-rule": {
    afterRepairValue: 2_200_000,
    estimatedRepairCost: 300_000,
    desiredProfitMargin: 12,
    sellingCosts: 90_000,
    holdingCosts: 45_000
  },
  "flip-profit": {
    purchasePrice: 1_800_000,
    rehabCost: 280_000,
    holdingCosts: 35_000,
    transferCosts: 95_000,
    financingCosts: 25_000,
    contingencyPercent: 10,
    sellingPrice: 2_650_000,
    sellingAgentCommissionPercent: 5
  },
  "wholesale-profit": {
    afterRepairValue: 2_200_000,
    repairCost: 350_000,
    desiredInvestorProfit: 180_000,
    assignmentFee: 45_000,
    buyerMaxOfferPercent: 70
  },
  "rehab-cost": {
    contingencyPercent: 12,
    items: REHAB_ITEMS_JSON
  },
  "rent-to-cost-ratio": {
    monthlyRent: 18_500,
    purchasePrice: 2_300_000,
    initialRepairCost: 40_000
  },
  grm: {
    purchasePrice: 2_300_000,
    monthlyGrossRent: 19_500,
    targetGRM: 12
  },
  ltv: {
    propertyValue: 2_300_000,
    loanAmount: 1_840_000
  },
  dcf: {
    initialInvestment: 450_000,
    discountRatePercent: 12,
    annualCashFlows: "42000, 44000, 46000, 48000, 50000",
    salePriceAtEnd: 2_750_000,
    sellingCosts: 165_000,
    holdPeriodYears: 5
  },
  "operating-expense-ratio": {
    annualOperatingExpenses: 96_000,
    annualGrossIncome: 222_000
  },
  "square-footage": {
    length: 12,
    width: 9.5
  }
};

export function getCalculatorDefaultValues(slug: string): Record<string, unknown> {
  const base = CALCULATOR_DEFAULT_VALUES[slug];
  if (!base) return {};
  if (slug === "noi") return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  return { ...base };
}
