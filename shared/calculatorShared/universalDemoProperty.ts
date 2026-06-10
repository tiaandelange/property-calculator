/**
 * Canonical demo property for public calculator pre-fill.
 * One consistent scenario: R2.3M purchase, 10.5% interest, 80% LTV, aligned income/expense/debt.
 *
 * Operating costs (~R3,200/mo excl. debt, self-managed): municipal rates ~R1,150 (typical metro band
 * on R2.3M valuation), insurance ~R500, maintenance reserve ~R450, modest levies ~R350, misc ~R750.
 */

import { calculateMonthlyBondPayment, calculateNOI } from "./calculatorHelpers.js";
import { calculateSouthAfricanTransferAndBondCosts } from "./saTransferBondCosts.js";

export const UNIVERSAL_DEMO_PROPERTY = {
  purchasePrice: 2_300_000,
  propertyValue: 2_300_000,
  ltvPercent: 80,
  depositAmount: 460_000,
  loanAmount: 1_840_000,
  annualInterestRatePercent: 10.5,
  loanTermYears: 20 as const,
  vatRatePercent: 15,
  sellerVatRegistered: false,

  monthlyRent: 25_300,
  otherMonthlyIncome: 0,
  vacancyRatePercent: 6,

  ratesAndTaxesMonthly: 1_150,
  leviesMonthly: 350,
  insuranceMonthly: 500,
  maintenanceMonthly: 450,
  propertyManagementPercent: 0,
  utilitiesPaidByOwnerMonthly: 0,
  accountingAdminMonthly: 0,
  otherExpensesMonthly: 750,

  annualRentGrowthPercent: 4,
  holdPeriodYears: 7,
  propertyAppreciationPercent: 5,
  rentEscalationPercent: 6,
  sellingCostsPercent: 5,

  strAverageDailyRate: 950,
  strOccupancyPercent: 62,
  strAvailableNightsPerMonth: 30,

  afterRepairValue: 2_400_000,
  rehabCost: 220_000,
  refinanceLtvPercent: 75,

  flipPurchasePrice: 1_800_000,
  flipRehabCost: 280_000,
  flipSellingPrice: 2_650_000,

  areaLengthM: 12,
  areaWidthM: 9.5,

  transferBondDisbursements: {
    municipalRatesClearanceProvision: 7_500,
    postagesAndPettiesEstimate: 1_200,
    ficaFeeEstimate: 850,
    deedsSearchFeeEstimate: 500,
    electronicInstructionFeeEstimate: 650,
    feeYear: "2026_2027" as const
  }
} as const;

export type UniversalDemoDerived = ReturnType<typeof deriveUniversalDemoMetrics>;

export function deriveUniversalDemoMetrics() {
  const p = UNIVERSAL_DEMO_PROPERTY;
  const grossMonthlyIncome = p.monthlyRent + p.otherMonthlyIncome;
  const managementFeeMonthly = grossMonthlyIncome * (p.propertyManagementPercent / 100);
  const monthlyOperatingExpenses =
    p.ratesAndTaxesMonthly +
    p.leviesMonthly +
    p.insuranceMonthly +
    p.maintenanceMonthly +
    managementFeeMonthly +
    p.utilitiesPaidByOwnerMonthly +
    p.accountingAdminMonthly +
    p.otherExpensesMonthly;

  const noi = calculateNOI({
    grossMonthlyRent: p.monthlyRent,
    otherMonthlyIncome: p.otherMonthlyIncome,
    vacancyRatePercent: p.vacancyRatePercent,
    monthlyOperatingExpenses
  });

  const bond = calculateMonthlyBondPayment({
    principal: p.loanAmount,
    annualInterestRatePercent: p.annualInterestRatePercent,
    termYears: p.loanTermYears
  });

  const monthlyBondPayment = bond.monthlyPayment;
  const annualDebtService = monthlyBondPayment * 12;
  const annualPreTaxCashFlow = noi.noiAnnual - annualDebtService;

  const transferBond = calculateSouthAfricanTransferAndBondCosts({
    purchasePrice: p.purchasePrice,
    marketValue: null,
    bondAmount: p.loanAmount,
    depositAmount: p.depositAmount,
    transactionType: p.sellerVatRegistered ? "VAT_TRANSACTION" : "TRANSFER_DUTY",
    buyerType: "INDIVIDUAL",
    includeBondRegistration: true,
    includeDepositInCashRequired: false,
    sellerVatRegistered: p.sellerVatRegistered,
    isFirstTimeBuyer: false,
    attorneyFeeMode: "ESTIMATE",
    vatRate: p.vatRatePercent,
    propertyUse: "INVESTMENT",
    ...p.transferBondDisbursements
  });

  const transferAndBondCosts = transferBond.totals.totalTransferAndBondCosts;
  const totalCashInvested =
    p.depositAmount + transferAndBondCosts + 25_000 + 15_000 + 5_000;

  const annualGrossRent = grossMonthlyIncome * 12;
  const grossYieldPercent = p.propertyValue > 0 ? (annualGrossRent / p.propertyValue) * 100 : 0;
  const capRatePercent = p.propertyValue > 0 ? (noi.noiAnnual / p.propertyValue) * 100 : 0;
  const totalProjectCost = p.purchasePrice + 40_000;
  const yieldOnCostPercent = totalProjectCost > 0 ? (noi.noiAnnual / totalProjectCost) * 100 : 0;
  const debtYieldPercent = p.loanAmount > 0 ? (noi.noiAnnual / p.loanAmount) * 100 : 0;
  const breakEvenOccupancyPercent =
    noi.grossPotentialIncomeAnnual > 0
      ? ((noi.operatingExpensesAnnual + annualDebtService) / noi.grossPotentialIncomeAnnual) * 100
      : 0;
  const loanConstantPercent = p.loanAmount > 0 ? (annualDebtService / p.loanAmount) * 100 : 0;
  const grm = annualGrossRent > 0 ? p.purchasePrice / annualGrossRent : 0;
  const dscr = annualDebtService > 0 ? noi.noiAnnual / annualDebtService : 0;

  return {
    grossMonthlyIncome,
    managementFeeMonthly,
    monthlyOperatingExpenses,
    monthlyBondPayment,
    annualDebtService,
    annualPreTaxCashFlow,
    noi,
    transferBond,
    transferAndBondCosts,
    totalCashInvested,
    annualGrossRent,
    grossYieldPercent,
    capRatePercent,
    totalProjectCost,
    yieldOnCostPercent,
    debtYieldPercent,
    breakEvenOccupancyPercent,
    loanConstantPercent,
    grm,
    dscr
  };
}

const REHAB_ITEMS_JSON = `[{"category":"kitchen","description":"Counters & cupboards","quantity":1,"unitCost":45000},{"category":"bathroom","description":"Retile & fixtures","quantity":1,"unitCost":32000},{"category":"general","description":"Paint & preparation","quantity":1,"unitCost":28000}]`;

/** Pre-filled form values per public calculator slug (see `frontend/src/data/calculators.ts`). */
export function buildUniversalCalculatorDefaults(slug: string): Record<string, unknown> {
  const p = UNIVERSAL_DEMO_PROPERTY;
  const d = deriveUniversalDemoMetrics();

  switch (slug) {
    case "transfer-bond-costs":
      return {
        transactionType: p.sellerVatRegistered ? "VAT_TRANSACTION" : "TRANSFER_DUTY",
        buyerType: "INDIVIDUAL",
        propertyUse: "INVESTMENT",
        includeBondRegistration: true,
        includeDepositInCashRequired: false,
        sellerVatRegistered: p.sellerVatRegistered,
        isFirstTimeBuyer: false,
        attorneyFeeMode: "ESTIMATE",
        vatRate: p.vatRatePercent,
        ...p.transferBondDisbursements,
        purchasePrice: p.purchasePrice,
        bondAmount: p.loanAmount,
        depositAmount: p.depositAmount
      };
    case "buy-vs-rent":
      return {
        purchasePrice: p.purchasePrice,
        monthlyRent: p.monthlyRent,
        depositAmount: p.depositAmount,
        interestRate: p.annualInterestRatePercent,
        analysisYears: 10,
        propertyAppreciation: p.propertyAppreciationPercent,
        rentEscalation: p.rentEscalationPercent
      };
    case "monthly-payment":
      return {
        purchasePrice: p.purchasePrice,
        depositAmount: p.depositAmount,
        bondAmount: p.loanAmount,
        annualInterestRate: p.annualInterestRatePercent,
        loanTermYears: p.loanTermYears
      };
    case "cash-flow":
      return {
        monthlyRent: p.monthlyRent,
        otherMonthlyIncome: p.otherMonthlyIncome,
        annualRentGrowthPercent: p.annualRentGrowthPercent,
        vacancyRatePercent: p.vacancyRatePercent,
        ratesAndTaxes: p.ratesAndTaxesMonthly,
        levies: p.leviesMonthly,
        insurance: p.insuranceMonthly,
        maintenance: p.maintenanceMonthly,
        propertyManagementPercent: p.propertyManagementPercent,
        utilitiesPaidByOwner: p.utilitiesPaidByOwnerMonthly,
        accountingAdmin: p.accountingAdminMonthly,
        otherExpenses: p.otherExpensesMonthly,
        bondAmount: p.loanAmount,
        annualInterestRate: p.annualInterestRatePercent,
        loanTermYears: p.loanTermYears
      };
    case "cash-on-cash-return":
      return {
        purchasePrice: p.purchasePrice,
        depositAmount: p.depositAmount,
        transferAndBondCosts: round2(d.transferAndBondCosts),
        initialRepairs: 25_000,
        furnishingCosts: 15_000,
        otherAcquisitionCosts: 5_000,
        monthlyRent: p.monthlyRent,
        otherMonthlyIncome: p.otherMonthlyIncome,
        vacancyRatePercent: p.vacancyRatePercent,
        monthlyOperatingExpenses: round2(d.monthlyOperatingExpenses),
        monthlyDebtService: round2(d.monthlyBondPayment)
      };
    case "noi":
      return {
        rentalIncomeAnnual: round2(d.noi.grossPotentialIncomeAnnual - p.otherMonthlyIncome * 12),
        otherIncomeAnnual: round2(p.otherMonthlyIncome * 12),
        vacancyRatePercent: p.vacancyRatePercent,
        maintenancePercentOfEffectiveGross: 0,
        rentGrowthPercentAnnual: p.annualRentGrowthPercent,
        expenseGrowthPercentAnnual: p.annualRentGrowthPercent,
        expenseItems: [
          { label: "Rates & taxes", annualAmount: round2(p.ratesAndTaxesMonthly * 12) },
          { label: "Levies", annualAmount: round2(p.leviesMonthly * 12) },
          { label: "Insurance", annualAmount: round2(p.insuranceMonthly * 12) },
          { label: "Maintenance", annualAmount: round2(p.maintenanceMonthly * 12) },
          { label: "Property management", annualAmount: round2(d.managementFeeMonthly * 12) }
        ]
      };
    case "cap-rate":
      return {
        propertyValue: p.propertyValue,
        annualNOI: round2(d.noi.noiAnnual),
        targetCapRatePercent: round2(d.capRatePercent)
      };
    case "dscr":
      return {
        annualNOI: round2(d.noi.noiAnnual),
        monthlyBondPayment: round2(d.monthlyBondPayment)
      };
    case "irr":
      return {
        holdPeriodYears: p.holdPeriodYears,
        totalCashInvested: 210_000,
        currentEstimatedValue: p.propertyValue,
        annualCashFlowAfterExpensesAndDebt: round2(d.annualPreTaxCashFlow),
        outstandingBondBalance: p.loanAmount,
        expectedAnnualAppreciationPercent: 3.5,
        estimatedSellingCostPercent: p.sellingCostsPercent,
        cashFlowGrowthPercentAnnual: 2
      };
    case "brrrr":
      return {
        purchasePrice: 1_650_000,
        rehabCost: p.rehabCost,
        transferAndBondCosts: round2(d.transferAndBondCosts * 0.9),
        afterRepairValue: p.afterRepairValue,
        refinanceLTVPercent: p.refinanceLtvPercent,
        originalLoanPayoff: 1_320_000,
        rentMonthly: p.monthlyRent,
        vacancyRatePercent: 5,
        monthlyOperatingExpenses: round2(d.monthlyOperatingExpenses),
        newInterestRate: p.annualInterestRatePercent,
        loanTermYears: p.loanTermYears
      };
    case "short-term-rental":
      return {
        averageDailyRate: p.strAverageDailyRate,
        occupancyRatePercent: p.strOccupancyPercent,
        availableNightsPerMonth: p.strAvailableNightsPerMonth,
        cleaningFeePerStay: 450,
        averageStayLength: 3,
        platformFeePercent: 15,
        managementFeePercent: 12,
        suppliesMonthly: 800,
        utilitiesMonthly: 900,
        insuranceMonthly: p.insuranceMonthly,
        ratesAndTaxesMonthly: p.ratesAndTaxesMonthly,
        maintenanceMonthly: p.maintenanceMonthly,
        monthlyDebtService: round2(d.monthlyBondPayment)
      };
    case "70-rule":
      return {
        afterRepairValue: 2_200_000,
        estimatedRepairCost: 300_000,
        desiredProfitMargin: 12,
        sellingCosts: 90_000,
        holdingCosts: 45_000
      };
    case "flip-profit":
      return {
        purchasePrice: p.flipPurchasePrice,
        rehabCost: p.flipRehabCost,
        holdingCosts: 35_000,
        transferCosts: round2(d.transferAndBondCosts),
        financingCosts: 25_000,
        contingencyPercent: 10,
        sellingPrice: p.flipSellingPrice,
        sellingAgentCommissionPercent: 5
      };
    case "wholesale-profit":
      return {
        afterRepairValue: 2_200_000,
        repairCost: 350_000,
        desiredInvestorProfit: 180_000,
        assignmentFee: 45_000,
        buyerMaxOfferPercent: 70
      };
    case "rehab-cost":
      return {
        contingencyPercent: 12,
        items: REHAB_ITEMS_JSON
      };
    case "rent-to-cost-ratio":
      return {
        monthlyRent: p.monthlyRent,
        purchasePrice: p.purchasePrice,
        initialRepairCost: 40_000
      };
    case "grm":
      return {
        purchasePrice: p.purchasePrice,
        monthlyGrossRent: p.monthlyRent,
        targetGRM: round2(d.grm)
      };
    case "ltv":
      return {
        propertyValue: p.propertyValue,
        loanAmount: p.loanAmount
      };
    case "dcf":
      return {
        initialInvestment: p.depositAmount,
        discountRatePercent: 12,
        annualCashFlows: `${Math.round(d.annualPreTaxCashFlow * 0.95)}, ${Math.round(d.annualPreTaxCashFlow)}, ${Math.round(d.annualPreTaxCashFlow * 1.05)}, ${Math.round(d.annualPreTaxCashFlow * 1.08)}, ${Math.round(d.annualPreTaxCashFlow * 1.1)}`,
        salePriceAtEnd: 2_750_000,
        sellingCosts: 165_000,
        holdPeriodYears: 5
      };
    case "operating-expense-ratio":
      return {
        annualOperatingExpenses: round2(d.noi.operatingExpensesAnnual),
        annualGrossIncome: round2(d.noi.effectiveGrossIncomeAnnual)
      };
    case "square-footage":
      return {
        length: p.areaLengthM,
        width: p.areaWidthM
      };
    case "gross-yield":
      return {
        purchasePrice: p.purchasePrice,
        monthlyGrossRent: p.monthlyRent,
        otherMonthlyIncome: p.otherMonthlyIncome
      };
    case "yield-on-cost":
      return {
        stabilisedNOI: round2(d.noi.noiAnnual),
        totalProjectCost: round2(d.totalProjectCost)
      };
    case "debt-yield":
      return {
        annualNOI: round2(d.noi.noiAnnual),
        loanAmount: p.loanAmount
      };
    case "break-even-occupancy":
      return {
        grossPotentialIncomeAnnual: round2(d.noi.grossPotentialIncomeAnnual),
        annualOperatingExpenses: round2(d.noi.operatingExpensesAnnual),
        annualDebtService: round2(d.annualDebtService)
      };
    case "loan-constant":
      return {
        loanAmount: p.loanAmount,
        monthlyBondPayment: round2(d.monthlyBondPayment)
      };
    default:
      return {};
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const TRANSFER_BOND_DEFAULTS = buildUniversalCalculatorDefaults("transfer-bond-costs");
