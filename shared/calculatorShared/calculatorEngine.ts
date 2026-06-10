import { z } from "zod";
import type { CalculatorResult, SummaryMetric } from "./calculatorTypes.js";
import {
  calculateAmortisationSchedule,
  calculateAnnualDebtService,
  calculateBreakEvenOccupancy,
  calculateCashFlow,
  calculateDebtYield,
  calculateGrossYield,
  calculateIRR,
  calculateLoanConstant,
  calculateMonthlyBondPayment,
  calculateNOI,
  calculateNPV,
  calculateYieldOnCost,
  clamp,
  formatCurrency,
  formatPercent,
  round2
} from "./calculatorHelpers.js";
import {
  calculateSouthAfricanTransferAndBondCosts,
  type AttorneyFeeMode,
  type BuyerType,
  type DeedsFeeYearKey,
  type TransactionType
} from "./saTransferBondCosts.js";
import { solveIrrPeriodicCashFlows } from "./irrSolver.js";
import {
  mapSimpleBuyVsRentToCalculatorResult,
  runSimpleBuyVsRentCalculator
} from "./buyVsRentSimple/simpleBuyVsRentCalculator.js";

type AnyInput = Record<string, unknown>;

const scenarioSchema = z.object({ scenarioName: z.string().trim().min(1).max(80).optional() }).passthrough();

const money = z.number().finite();
const percent = z.number().finite();

function metric(key: string, label: string, unit: "currency" | "percent" | "number", value: number | null): SummaryMetric {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) {
    return {
      key,
      label,
      unit,
      value: null,
      formatted: unit === "percent" ? "Insufficient data" : "—"
    };
  }
  const formatted =
    unit === "currency" ? formatCurrency(value) : unit === "percent" ? formatPercent(value) : round2(value).toString();
  return { key, label, unit, value: round2(value), formatted };
}

function baseResult(calculator: string, scenarioName?: string): Omit<CalculatorResult, "summary" | "breakdown" | "interpretation" | "chartData" | "assumptionsUsed"> {
  return { calculator, scenarioName };
}

function requirePositive(name: string, value: number, warnings: string[]) {
  if (!Number.isFinite(value) || value <= 0) warnings.push(`${name} should be greater than 0.`);
}

// 1) Transfer & Bond Costs (SA)
const buyerTypeEnum = z.enum(["INDIVIDUAL", "COMPANY", "TRUST", "individual", "company", "trust"]);
const transactionTypeEnum = z.enum(["TRANSFER_DUTY", "VAT_TRANSACTION"]);
const attorneyModeEnum = z.enum(["ESTIMATE", "MANUAL", "estimate", "manual"]);

function normalizeBuyerType(v: z.infer<typeof buyerTypeEnum>): BuyerType {
  const s = String(v).toUpperCase();
  if (s === "COMPANY") return "COMPANY";
  if (s === "TRUST") return "TRUST";
  return "INDIVIDUAL";
}

function normalizeAttorneyMode(v: z.infer<typeof attorneyModeEnum>): AttorneyFeeMode {
  return String(v).toUpperCase() === "MANUAL" ? "MANUAL" : "ESTIMATE";
}

const transferBondSchema = scenarioSchema.extend({
  purchasePrice: z.number().finite().positive({ message: "Purchase price must be greater than 0" }),
  marketValue: money.nonnegative().optional().nullable(),
  bondAmount: money.nonnegative(),
  depositAmount: money.nonnegative().optional().nullable(),
  transactionType: transactionTypeEnum.optional(),
  /** @deprecated Use `transactionType: VAT_TRANSACTION` */
  propertyIsVatTransaction: z.boolean().optional(),
  buyerType: buyerTypeEnum.default("INDIVIDUAL"),
  sellerVatRegistered: z.boolean().optional().default(false),
  includeBondRegistration: z.boolean().default(true),
  province: z.string().trim().max(80).optional().nullable(),
  municipality: z.string().trim().max(120).optional().nullable(),
  municipalRatesClearanceProvision: money.nonnegative().default(7500),
  postagesAndPettiesEstimate: money.nonnegative().default(1200),
  ficaFeeEstimate: money.nonnegative().default(850),
  deedsSearchFeeEstimate: money.nonnegative().default(500),
  electronicInstructionFeeEstimate: money.nonnegative().default(650),
  vatRate: money.nonnegative().max(30).default(15),
  attorneyFeeMode: attorneyModeEnum.default("ESTIMATE"),
  manualTransferAttorneyFee: money.nonnegative().optional().nullable(),
  manualBondAttorneyFee: money.nonnegative().optional().nullable(),
  includeDepositInCashRequired: z.boolean().default(false),
  feeYear: z.enum(["2026_2027", "2025_2026"]).default("2026_2027"),
  isFirstTimeBuyer: z.boolean().optional().default(false),
  propertyUse: z
    .enum(["PRIMARY_RESIDENCE", "INVESTMENT", "COMMERCIAL", "VACANT_LAND", "OTHER"])
    .optional()
    .nullable()
});

function calcTransferBondCosts(input: z.infer<typeof transferBondSchema>): CalculatorResult {
  const warnings: string[] = [];
  requirePositive("Purchase price", input.purchasePrice, warnings);

  const transactionType: TransactionType =
    input.transactionType ??
    (input.propertyIsVatTransaction === true ? "VAT_TRANSACTION" : "TRANSFER_DUTY");

  const sa = calculateSouthAfricanTransferAndBondCosts({
    purchasePrice: input.purchasePrice,
    marketValue: input.marketValue ?? null,
    bondAmount: input.bondAmount,
    depositAmount: input.depositAmount ?? 0,
    transactionType,
    buyerType: normalizeBuyerType(input.buyerType),
    includeBondRegistration: input.includeBondRegistration,
    province: input.province ?? null,
    municipality: input.municipality ?? null,
    municipalRatesClearanceProvision: input.municipalRatesClearanceProvision,
    postagesAndPettiesEstimate: input.postagesAndPettiesEstimate,
    ficaFeeEstimate: input.ficaFeeEstimate,
    deedsSearchFeeEstimate: input.deedsSearchFeeEstimate,
    electronicInstructionFeeEstimate: input.electronicInstructionFeeEstimate,
    vatRate: input.vatRate,
    attorneyFeeMode: normalizeAttorneyMode(input.attorneyFeeMode),
    manualTransferAttorneyFee: input.manualTransferAttorneyFee ?? null,
    manualBondAttorneyFee: input.manualBondAttorneyFee ?? null,
    includeDepositInCashRequired: input.includeDepositInCashRequired,
    feeYear: input.feeYear as DeedsFeeYearKey,
    isFirstTimeBuyer: input.isFirstTimeBuyer,
    sellerVatRegistered: input.sellerVatRegistered,
    propertyUse: input.propertyUse ?? undefined
  });

  const mergedWarnings = [...new Set([...warnings, ...sa.warnings])];

  const td = sa.transferCosts.transferDuty;
  let transferDutyNote = "";
  if (transactionType === "VAT_TRANSACTION") {
    transferDutyNote = " VAT transaction selected. Transfer duty not applied.";
  } else if (td <= 0) {
    transferDutyNote = " No transfer duty payable based on the selected property value.";
  }

  const summary = [
    metric("transferDuty", "Transfer duty", "currency", sa.transferCosts.transferDuty),
    metric("totalTransferCosts", "Transfer costs (incl. duty, attorney, Deeds, municipal, admin)", "currency", sa.totals.totalTransferCosts),
    metric("totalBondRegistrationCosts", "Bond registration costs", "currency", sa.totals.totalBondRegistrationCosts),
    metric("totalCashRequiredExcludingDeposit", "Total costs excluding deposit", "currency", sa.totals.totalCashRequiredExcludingDeposit),
    metric(
      "totalCashRequiredIncludingDeposit",
      "Total cash incl. deposit (if enabled)",
      "currency",
      input.includeDepositInCashRequired ? sa.totals.totalCashRequiredIncludingDeposit : null
    ),
    metric("totalAcquisitionCost", "Total acquisition cost (purchase + transfer & bond)", "currency", sa.totals.totalAcquisitionCost)
  ];

  const chartLabels = sa.chartData.costBreakdown.map((c) => c.label);
  const chartValues = sa.chartData.costBreakdown.map((c) => c.value);
  const chartData = [
    {
      chartType: "doughnut" as const,
      title: "Cost breakdown",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "ZAR",
            data: chartValues,
            backgroundColor: ["#c99a5b", "#1f8de0", "#4d7c0f", "#2b2b2b", "#555555", "#8b5cf6"]
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: "bottom" as const }
        }
      }
    }
  ];

  const interpretationText =
    `Estimated buyer upfront cash required before registration (excluding deposit unless toggled): ${formatCurrency(sa.totals.totalCashRequiredExcludingDeposit)}.` +
    transferDutyNote +
    ` Total acquisition (purchase price plus transfer and bond cost estimates): ${formatCurrency(sa.totals.totalAcquisitionCost)}.`;

  return {
    ...baseResult("transfer-bond-costs", input.scenarioName),
    summary,
    breakdown: {
      ...sa,
      transferDuty: sa.transferCosts.transferDuty,
      totalCashRequiredBeforeRegistration: sa.totals.totalCashRequiredExcludingDeposit,
      totalIncludingDeposit: input.includeDepositInCashRequired ? sa.totals.totalCashRequiredIncludingDeposit : null,
      legacyPropertyIsVatTransaction: transactionType === "VAT_TRANSACTION",
      municipalProvisionEstimate: input.municipalRatesClearanceProvision
    },
    interpretation: { text: interpretationText, warnings: mergedWarnings },
    chartData,
    assumptionsUsed: {
      assumptions: sa.assumptions,
      feeYear: input.feeYear,
      vatRatePercent: input.vatRate,
      sellerVatRegistered: input.sellerVatRegistered,
      isFirstTimeBuyer: input.isFirstTimeBuyer,
      propertyUse: input.propertyUse ?? null,
      disclaimer:
        "This is an estimate and not legal, tax or financial advice. Confirm costs with your conveyancer, bank and SARS."
    }
  };
}

// 2) Monthly Bond Payment (with amortisation)
const monthlyBondSchema = scenarioSchema.extend({
  purchasePrice: money.nonnegative().optional(),
  depositAmount: money.nonnegative().default(0),
  bondAmount: money.nonnegative().optional(),
  annualInterestRate: percent.min(0).max(100),
  loanTermYears: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(25), z.literal(30)]),
  extraMonthlyPayment: money.nonnegative().optional(),
  onceOffExtraPayment: money.nonnegative().optional()
});

function calcMonthlyBond(input: z.infer<typeof monthlyBondSchema>): CalculatorResult {
  const warnings: string[] = [];
  const inferredBond = input.bondAmount ?? Math.max(0, (input.purchasePrice ?? 0) - input.depositAmount);
  if ((input.purchasePrice ?? 0) > 0 && input.depositAmount > (input.purchasePrice ?? 0)) warnings.push("Deposit is larger than purchase price.");

  const base = calculateAmortisationSchedule({
    principal: inferredBond,
    annualInterestRatePercent: input.annualInterestRate,
    termYears: input.loanTermYears,
    extraMonthlyPayment: input.extraMonthlyPayment,
    onceOffExtraPayment: input.onceOffExtraPayment
  });

  const noExtra = calculateAmortisationSchedule({
    principal: inferredBond,
    annualInterestRatePercent: input.annualInterestRate,
    termYears: input.loanTermYears
  });

  const interestSavedWithExtraPayments = noExtra.totalInterest - base.totalInterest;
  const payoffTimeWithExtraPaymentsMonths = base.monthsToPayoff;

  const balanceSeries = base.schedule.map((r) => round2(r.balance));
  const cumInterestSeries: number[] = [];
  let cum = 0;
  base.schedule.forEach((r) => {
    cum += r.interest;
    cumInterestSeries.push(round2(cum));
  });

  const yearlyLabels = base.yearly.map((y) => `Y${y.year}`);
  const principalByYear = base.yearly.map((y) => round2(y.principal));
  const interestByYear = base.yearly.map((y) => round2(y.interest));

  const summary = [
    metric("monthlyPayment", "Monthly bond payment", "currency", base.monthlyPayment + (input.extraMonthlyPayment ?? 0)),
    metric("totalPaid", "Total paid (incl. extras)", "currency", base.totalPaid),
    metric("totalInterest", "Total interest", "currency", base.totalInterest),
    metric("interestSaved", "Interest saved vs no extras", "currency", Math.max(0, interestSavedWithExtraPayments))
  ];

  const chartData = [
    {
      chartType: "line" as const,
      title: "Outstanding balance over time",
      data: {
        labels: base.schedule.filter((r) => r.month % 12 === 0 || r.month === 1).map((r) => `M${r.month}`),
        datasets: [{
          label: "Outstanding balance",
          data: base.schedule.filter((r) => r.month % 12 === 0 || r.month === 1).map((r) => round2(r.balance)),
          borderColor: "#007acc"
        }]
      }
    },
    {
      chartType: "bar" as const,
      title: "Principal vs interest by year",
      data: {
        labels: yearlyLabels,
        datasets: [
          { label: "Principal", data: principalByYear, backgroundColor: "#007acc", stack: "pi" },
          { label: "Interest", data: interestByYear, backgroundColor: "#2b2b2b", stack: "pi" }
        ]
      }
    }
  ];

  const interpretationText =
    `At ${round2(input.annualInterestRate).toFixed(2)}% over ${input.loanTermYears} years, your base monthly payment is ${formatCurrency(noExtra.monthlyPayment)}.` +
    (input.extraMonthlyPayment || input.onceOffExtraPayment
      ? ` With extra payments, the bond is paid off in about ${Math.floor(payoffTimeWithExtraPaymentsMonths / 12)} years and ${payoffTimeWithExtraPaymentsMonths % 12} months, saving ~${formatCurrency(Math.max(0, interestSavedWithExtraPayments))} in interest.`
      : "");

  return {
    ...baseResult("monthly-payment", input.scenarioName),
    summary,
    breakdown: {
      purchasePrice: input.purchasePrice ?? null,
      depositAmount: input.depositAmount,
      bondAmount: inferredBond,
      annualInterestRate: input.annualInterestRate,
      loanTermYears: input.loanTermYears,
      monthlyPaymentBase: noExtra.monthlyPayment,
      monthlyPaymentWithExtras: base.monthlyPayment + (input.extraMonthlyPayment ?? 0),
      totalPaid: base.totalPaid,
      totalInterest: base.totalInterest,
      payoffTimeWithExtraPaymentsMonths,
      interestSavedWithExtraPayments,
      amortisationScheduleMonthly: base.schedule,
      amortisationScheduleYearly: base.yearly,
      cumulativeInterestSeries: cumInterestSeries,
      balanceSeries
    },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: {
      paymentTiming: "Monthly payments at end of period (standard amortisation).",
      rounding: "All displayed currency values rounded to 2 decimals."
    }
  };
}

// 3) Cash Flow
const cashFlowSchema = scenarioSchema.extend({
  monthlyRent: money.nonnegative(),
  otherMonthlyIncome: money.nonnegative().default(0),
  annualRentGrowthPercent: percent.min(0).max(50).default(0),
  vacancyRatePercent: percent.min(0).max(100).default(0),
  ratesAndTaxes: money.nonnegative().default(0),
  levies: money.nonnegative().default(0),
  insurance: money.nonnegative().default(0),
  maintenance: money.nonnegative().default(0),
  propertyManagementPercent: percent.min(0).max(30).default(0),
  utilitiesPaidByOwner: money.nonnegative().default(0),
  accountingAdmin: money.nonnegative().default(0),
  otherExpenses: money.nonnegative().default(0),
  monthlyBondPayment: money.nonnegative().default(0)
});

function calcCashFlow(input: z.infer<typeof cashFlowSchema>): CalculatorResult {
  const warnings: string[] = [];
  const grossMonthlyIncome = input.monthlyRent + input.otherMonthlyIncome;
  const vacancyLoss = grossMonthlyIncome * (clamp(input.vacancyRatePercent, 0, 100) / 100);
  const managementFee = grossMonthlyIncome * (clamp(input.propertyManagementPercent, 0, 100) / 100);

  const monthlyOperatingExpenses =
    input.ratesAndTaxes +
    input.levies +
    input.insurance +
    input.maintenance +
    managementFee +
    input.utilitiesPaidByOwner +
    input.accountingAdmin +
    input.otherExpenses;

  const cf = calculateCashFlow({
    grossMonthlyIncome,
    vacancyLossMonthly: vacancyLoss,
    monthlyOperatingExpenses,
    monthlyDebtService: input.monthlyBondPayment
  });

  const breakEvenRent =
    (monthlyOperatingExpenses + input.monthlyBondPayment) / Math.max(1 - clamp(input.vacancyRatePercent, 0, 100) / 100, 0.01);

  if (input.monthlyRent === 0) warnings.push("Monthly rent is R0. Cash flow will likely be negative.");
  if (input.vacancyRatePercent >= 30) warnings.push("Vacancy rate is high. Consider stress-testing alternative scenarios.");

  const summary = [
    metric("monthlyCashFlow", "Monthly cash flow", "currency", cf.monthlyCashFlow),
    metric("annualCashFlow", "Annual cash flow", "currency", cf.annualCashFlow),
    metric("monthlyNOI", "Monthly NOI", "currency", cf.monthlyNOI),
    metric("cashFlowMargin", "Cash flow margin", "percent", cf.cashFlowMarginPercent)
  ];

  const chartData = [{
    chartType: "bar" as const,
    title: "Cash flow bridge (monthly)",
    data: {
      labels: ["Income", "Vacancy", "Operating", "Debt", "Cash flow"],
      datasets: [{
        label: "Monthly ZAR",
        data: [grossMonthlyIncome, -vacancyLoss, -monthlyOperatingExpenses, -input.monthlyBondPayment, cf.monthlyCashFlow],
        backgroundColor: ["#007acc", "#555555", "#2b2b2b", "#111111", cf.monthlyCashFlow >= 0 ? "#1f8de0" : "#b44444"]
      }]
    }
  }];

  const interpretationText =
    `Effective monthly income is ${formatCurrency(cf.effectiveMonthlyIncome)} after vacancy. ` +
    `After operating expenses and debt service, cash flow is ${formatCurrency(cf.monthlyCashFlow)} per month.` +
    (cf.monthlyCashFlow < 0 ? " This is cash-flow negative—consider negotiating price, increasing rent, or reducing expenses." : " This is cash-flow positive—stress-test vacancy and maintenance assumptions.");

  return {
    ...baseResult("cash-flow", input.scenarioName),
    summary,
    breakdown: {
      grossMonthlyIncome,
      vacancyLoss,
      effectiveMonthlyIncome: cf.effectiveMonthlyIncome,
      monthlyOperatingExpenses,
      monthlyNOI: cf.monthlyNOI,
      monthlyDebtService: input.monthlyBondPayment,
      monthlyCashFlow: cf.monthlyCashFlow,
      annualCashFlow: cf.annualCashFlow,
      cashFlowMarginPercent: cf.cashFlowMarginPercent,
      breakEvenRent
    },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: {
      managementFeeCalculatedFrom: "Gross monthly income",
      rentGrowthPercent: input.annualRentGrowthPercent
    }
  };
}

// 4) Cash-on-cash ROI
const cocSchema = scenarioSchema.extend({
  purchasePrice: money.nonnegative(),
  depositAmount: money.nonnegative().default(0),
  transferAndBondCosts: money.nonnegative().default(0),
  initialRepairs: money.nonnegative().default(0),
  furnishingCosts: money.nonnegative().default(0),
  otherAcquisitionCosts: money.nonnegative().default(0),
  annualCashFlow: money.optional(),
  // optional path to compute cash flow
  monthlyRent: money.nonnegative().optional(),
  otherMonthlyIncome: money.nonnegative().optional(),
  vacancyRatePercent: percent.min(0).max(100).optional(),
  monthlyOperatingExpenses: money.nonnegative().optional(),
  monthlyDebtService: money.nonnegative().optional()
});

function calcCashOnCash(input: z.infer<typeof cocSchema>): CalculatorResult {
  const warnings: string[] = [];
  const totalCashInvested =
    input.depositAmount +
    input.transferAndBondCosts +
    input.initialRepairs +
    input.furnishingCosts +
    input.otherAcquisitionCosts;

  let annualPreTaxCashFlow = input.annualCashFlow ?? 0;
  let monthlyCashFlow: number | null = null;
  let cashFlowBreakdown: Record<string, unknown> | null = null;

  if (input.annualCashFlow === undefined) {
    if (
      input.monthlyRent === undefined ||
      input.vacancyRatePercent === undefined ||
      input.monthlyOperatingExpenses === undefined ||
      input.monthlyDebtService === undefined
    ) {
      warnings.push("Annual cash flow not provided. Provide either annualCashFlow or the cash flow inputs.");
    } else {
      const grossMonthlyIncome = (input.monthlyRent ?? 0) + (input.otherMonthlyIncome ?? 0);
      const vacancyLoss = grossMonthlyIncome * (clamp(input.vacancyRatePercent ?? 0, 0, 100) / 100);
      const cf = calculateCashFlow({
        grossMonthlyIncome,
        vacancyLossMonthly: vacancyLoss,
        monthlyOperatingExpenses: input.monthlyOperatingExpenses ?? 0,
        monthlyDebtService: input.monthlyDebtService ?? 0
      });
      monthlyCashFlow = cf.monthlyCashFlow;
      annualPreTaxCashFlow = cf.annualCashFlow;
      cashFlowBreakdown = cf;
    }
  } else {
    monthlyCashFlow = annualPreTaxCashFlow / 12;
  }

  const cashOnCashReturnPercent = totalCashInvested > 0 ? (annualPreTaxCashFlow / totalCashInvested) * 100 : 0;
  const paybackPeriodYears = annualPreTaxCashFlow > 0 ? totalCashInvested / annualPreTaxCashFlow : null;

  let classification: CalculatorResult["interpretation"]["classification"] = "acceptable";
  if (cashOnCashReturnPercent < 0) classification = "weak";
  else if (cashOnCashReturnPercent < 5) classification = "weak";
  else if (cashOnCashReturnPercent < 8) classification = "acceptable";
  else if (cashOnCashReturnPercent < 12) classification = "strong";
  else classification = "very-strong";

  const interpretationText =
    `You invested ${formatCurrency(totalCashInvested)} in cash. With annual pre-tax cash flow of ${formatCurrency(annualPreTaxCashFlow)}, ` +
    `cash-on-cash return is ${formatPercent(cashOnCashReturnPercent)}.` +
    (paybackPeriodYears ? ` Payback period is ~${round2(paybackPeriodYears)} years (ignores resale value).` : "");

  const chartData = [
    {
      chartType: "bar" as const,
      title: "Cash invested components",
      data: {
        labels: ["Deposit", "Transfer & bond costs", "Repairs", "Furnishing", "Other"],
        datasets: [{
          label: "ZAR",
          data: [input.depositAmount, input.transferAndBondCosts, input.initialRepairs, input.furnishingCosts, input.otherAcquisitionCosts],
          backgroundColor: "#007acc"
        }]
      }
    },
    {
      chartType: "line" as const,
      title: "Cumulative cash flow vs cash invested (5y)",
      data: {
        labels: ["Y1", "Y2", "Y3", "Y4", "Y5"],
        datasets: [
          {
            label: "Cumulative cash flow",
            data: [1, 2, 3, 4, 5].map((y) => round2(annualPreTaxCashFlow * y)),
            borderColor: "#007acc"
          },
          {
            label: "Cash invested",
            data: [1, 2, 3, 4, 5].map(() => round2(totalCashInvested)),
            borderColor: "#2b2b2b"
          }
        ]
      }
    }
  ];

  return {
    ...baseResult("cash-on-cash-return", input.scenarioName),
    summary: [
      metric("cashOnCashReturnPercent", "Cash-on-cash return", "percent", cashOnCashReturnPercent),
      metric("annualPreTaxCashFlow", "Annual pre-tax cash flow", "currency", annualPreTaxCashFlow),
      metric("totalCashInvested", "Total cash invested", "currency", totalCashInvested),
      metric("monthlyCashFlow", "Monthly cash flow", "currency", monthlyCashFlow ?? annualPreTaxCashFlow / 12)
    ],
    breakdown: {
      totalCashInvested,
      annualPreTaxCashFlow,
      cashOnCashReturnPercent,
      paybackPeriodYears,
      monthlyCashFlow,
      cashInvestedComponents: {
        depositAmount: input.depositAmount,
        transferAndBondCosts: input.transferAndBondCosts,
        initialRepairs: input.initialRepairs,
        furnishingCosts: input.furnishingCosts,
        otherAcquisitionCosts: input.otherAcquisitionCosts
      },
      cashFlowBreakdown
    },
    interpretation: { text: interpretationText, classification, warnings },
    chartData,
    assumptionsUsed: { paybackIgnoresResale: true }
  };
}

// 5) NOI — legacy monthly buckets OR annual income + expense line items + maintenance % of effective gross
const noiExpenseItemSchema = z.object({
  label: z.string().trim().min(1).default("Expense"),
  annualAmount: money.nonnegative()
});

const noiSchema = scenarioSchema.extend({
  grossMonthlyRent: money.nonnegative().optional(),
  otherMonthlyIncome: money.nonnegative().optional(),
  vacancyRatePercent: percent.min(0).max(100).default(0),
  ratesAndTaxes: money.nonnegative().default(0),
  levies: money.nonnegative().default(0),
  insurance: money.nonnegative().default(0),
  maintenance: money.nonnegative().default(0),
  propertyManagement: money.nonnegative().default(0),
  utilities: money.nonnegative().default(0),
  admin: money.nonnegative().default(0),
  otherOperatingExpenses: money.nonnegative().default(0),
  rentalIncomeAnnual: money.nonnegative().optional(),
  otherIncomeAnnual: money.nonnegative().optional(),
  maintenancePercentOfEffectiveGross: percent.min(0).max(50).default(0),
  expenseItems: z.array(noiExpenseItemSchema).optional(),
  rentGrowthPercentAnnual: percent.min(0).max(30).default(6),
  expenseGrowthPercentAnnual: percent.min(0).max(30).default(6)
}).superRefine((data, ctx) => {
  const annual = data.rentalIncomeAnnual != null && data.rentalIncomeAnnual > 0;
  const legacy = data.grossMonthlyRent != null && data.grossMonthlyRent > 0;
  if (!annual && !legacy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide rental income (annual) or gross monthly rent.", path: ["rentalIncomeAnnual"] });
  }
  if (annual && (!data.expenseItems || data.expenseItems.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least one operating expense line.", path: ["expenseItems"] });
  }
});

function noiAnnualFromInputs(input: z.infer<typeof noiSchema>): {
  rentalAnnual0: number;
  otherAnnual0: number;
  vacancyPct: number;
  lineExpenseAnnual0: number;
  maintPctOfEffective: number;
  rentGrowth: number;
  expenseGrowth: number;
  doughnutLabels: string[];
  doughnutValues: number[];
  legacyMode: boolean;
  grossMonthlyRent: number;
  otherMonthlyIncome: number;
  monthlyOperatingExpenses: number;
} {
  const vacancyPct = clamp(input.vacancyRatePercent ?? 0, 0, 100);
  const rentG = input.rentGrowthPercentAnnual ?? 6;
  const expG = input.expenseGrowthPercentAnnual ?? 6;
  const maintPct = clamp(input.maintenancePercentOfEffectiveGross ?? 0, 0, 50);

  if (input.rentalIncomeAnnual != null && Number.isFinite(input.rentalIncomeAnnual)) {
    const rentalAnnual0 = Math.max(0, input.rentalIncomeAnnual);
    const otherAnnual0 = Math.max(0, input.otherIncomeAnnual ?? 0);
    const items = input.expenseItems?.length ? input.expenseItems : [{ label: "Operating expenses", annualAmount: 0 }];
    const lineExpenseAnnual0 = items.reduce((s, it) => s + Math.max(0, it.annualAmount), 0);
    const rentM = rentalAnnual0 / 12;
    const otherM = otherAnnual0 / 12;
    const lineM = lineExpenseAnnual0 / 12;
    const g = rentM + otherM;
    const eff = g * (1 - vacancyPct / 100);
    const maintM = eff * (maintPct / 100);
    const totalOpEx = lineM + maintM;
    const doughnutLabels = [...items.map((i) => i.label), ...(maintPct > 0 ? ["Maintenance (%)"] : [])];
    const doughnutValues = [...items.map((i) => i.annualAmount / 12), ...(maintPct > 0 ? [maintM] : [])];
    return {
      rentalAnnual0,
      otherAnnual0,
      vacancyPct,
      lineExpenseAnnual0,
      maintPctOfEffective: maintPct,
      rentGrowth: rentG,
      expenseGrowth: expG,
      doughnutLabels,
      doughnutValues,
      legacyMode: false,
      grossMonthlyRent: rentM,
      otherMonthlyIncome: otherM,
      monthlyOperatingExpenses: totalOpEx
    };
  }

  const grossMonthlyRent = input.grossMonthlyRent ?? 0;
  const otherMonthlyIncome = input.otherMonthlyIncome ?? 0;
  const operatingExpensesMonthly =
    input.ratesAndTaxes +
    input.levies +
    input.insurance +
    input.maintenance +
    input.propertyManagement +
    input.utilities +
    input.admin +
    input.otherOperatingExpenses;
  const rentalAnnual0 = grossMonthlyRent * 12;
  const otherAnnual0 = otherMonthlyIncome * 12;
  const lineExpenseAnnual0 = operatingExpensesMonthly * 12;
  return {
    rentalAnnual0,
    otherAnnual0,
    vacancyPct,
    lineExpenseAnnual0: Math.max(0, lineExpenseAnnual0),
    maintPctOfEffective: 0,
    rentGrowth: rentG,
    expenseGrowth: expG,
    doughnutLabels: ["Rates & taxes", "Levies", "Insurance", "Maintenance", "Management", "Utilities", "Admin", "Other"],
    doughnutValues: [
      input.ratesAndTaxes,
      input.levies,
      input.insurance,
      input.maintenance,
      input.propertyManagement,
      input.utilities,
      input.admin,
      input.otherOperatingExpenses
    ],
    legacyMode: true,
    grossMonthlyRent,
    otherMonthlyIncome,
    monthlyOperatingExpenses: operatingExpensesMonthly
  };
}

function noiProjectedAnnualSeries(p: ReturnType<typeof noiAnnualFromInputs>): number[] {
  const years = 5;
  const out: number[] = [];
  for (let y = 0; y < years; y++) {
    const rentA = p.rentalAnnual0 * Math.pow(1 + p.rentGrowth / 100, y);
    const otherA = p.otherAnnual0 * Math.pow(1 + p.rentGrowth / 100, y);
    const grossMonthly = (rentA + otherA) / 12;
    const vacancyLoss = grossMonthly * (p.vacancyPct / 100);
    const effMonthly = grossMonthly - vacancyLoss;
    const lineM = (p.lineExpenseAnnual0 * Math.pow(1 + p.expenseGrowth / 100, y)) / 12;
    const maintM = p.maintPctOfEffective > 0 ? effMonthly * (p.maintPctOfEffective / 100) : 0;
    const noiM = effMonthly - lineM - maintM;
    out.push(round2(noiM * 12));
  }
  return out;
}

function calcNOI(input: z.infer<typeof noiSchema>): CalculatorResult {
  const warnings: string[] = [];
  if (input.rentalIncomeAnnual == null && (input.grossMonthlyRent == null || input.grossMonthlyRent <= 0)) {
    warnings.push("Provide rental income (annual) or gross monthly rent.");
  }

  const norm = noiAnnualFromInputs(input);
  const noi = calculateNOI({
    grossMonthlyRent: norm.grossMonthlyRent,
    otherMonthlyIncome: norm.otherMonthlyIncome,
    vacancyRatePercent: norm.vacancyPct,
    monthlyOperatingExpenses: norm.monthlyOperatingExpenses
  });

  const operatingExpenseRatioPercent =
    noi.effectiveGrossIncomeAnnual > 0 ? (noi.operatingExpensesAnnual / noi.effectiveGrossIncomeAnnual) * 100 : 0;

  const projectionAnnual = noiProjectedAnnualSeries(norm);

  if (norm.vacancyPct >= 100) warnings.push("Vacancy is 100%: effective income is zero.");

  const chartData = [
    {
      chartType: "line" as const,
      title: "NOI over time (5-year projection)",
      data: {
        labels: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
        datasets: [
          {
            label: "Projected annual NOI",
            data: projectionAnnual,
            borderColor: "#c99a5b",
            backgroundColor: "rgba(201, 154, 91, 0.18)",
            fill: true,
            tension: 0.25
          }
        ]
      },
      options: {
        plugins: { legend: { position: "bottom" as const } },
        scales: {
          y: {
            ticks: {
              callback: (v: string | number) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return String(v);
                if (Math.abs(n) >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}M`;
                return `R ${Math.round(n / 1000)}k`;
              }
            }
          }
        }
      } as any
    },
    {
      chartType: "doughnut" as const,
      title: "Operating expense breakdown (monthly)",
      data: {
        labels: norm.doughnutLabels,
        datasets: [
          {
            label: "ZAR",
            data: norm.doughnutValues,
            backgroundColor: ["#c99a5b", "#1f8de0", "#2b2b2b", "#3a3a3a", "#4a4a4a", "#5a5a5a", "#6a6a6a", "#7a7a7a", "#8a8a8a"]
          }
        ]
      }
    },
    {
      chartType: "bar" as const,
      title: "Income vs NOI (annual)",
      data: {
        labels: ["Gross potential", "Effective gross", "NOI"],
        datasets: [
          {
            label: "ZAR",
            data: [noi.grossPotentialIncomeAnnual, noi.effectiveGrossIncomeAnnual, noi.noiAnnual],
            backgroundColor: "#1f8de0"
          }
        ]
      }
    }
  ];

  const interpretationText =
    `Your NOI is ${formatCurrency(noi.noiAnnual)} per year (${formatCurrency(noi.noiMonthly)} per month). ` +
    `Operating expense ratio is ${formatPercent(operatingExpenseRatioPercent)}. ` +
    `NOI excludes bond repayments, tax, depreciation, and capital improvements.`;

  return {
    ...baseResult("noi", input.scenarioName),
    summary: [
      metric("noiAnnual", "NOI (annual)", "currency", noi.noiAnnual),
      metric("grossOperatingIncomeAnnual", "Gross operating income (annual)", "currency", noi.grossPotentialIncomeAnnual),
      metric("totalOperatingExpensesAnnual", "Total operating expenses (annual)", "currency", noi.operatingExpensesAnnual),
      metric("operatingExpenseRatioPercent", "Operating expense ratio", "percent", operatingExpenseRatioPercent)
    ],
    breakdown: {
      ...noi,
      operatingExpenseRatioPercent,
      noiProjection5YearAnnual: projectionAnnual,
      rentGrowthPercentAnnual: norm.rentGrowth,
      expenseGrowthPercentAnnual: norm.expenseGrowth,
      noiInputMode: norm.legacyMode ? "legacy_monthly" : "annual_line_items",
      operatingExpensesBreakdownMonthly: norm.legacyMode
        ? {
            ratesAndTaxes: input.ratesAndTaxes,
            levies: input.levies,
            insurance: input.insurance,
            maintenance: input.maintenance,
            propertyManagement: input.propertyManagement,
            utilities: input.utilities,
            admin: input.admin,
            otherOperatingExpenses: input.otherOperatingExpenses
          }
        : { expenseItems: input.expenseItems ?? [] }
    },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: {
      noiExcludesDebtService: true,
      fiveYearProjectionNote:
        "Projection applies rent growth and expense growth to the income and operating cost bases each year (maintenance % applies to effective gross each year)."
    }
  };
}

// 6) Cap Rate
const capRateSchema = scenarioSchema.extend({
  propertyValue: money.nonnegative().optional(),
  purchasePrice: money.nonnegative().optional(),
  annualNOI: money
    .refine((v) => Number.isFinite(v), "annualNOI must be a number")
    .optional(),
  // compatibility with old input
  noi: money.nonnegative().optional(),
  targetCapRatePercent: percent.min(0).max(30).default(8)
});

function calcCapRate(input: z.infer<typeof capRateSchema>): CalculatorResult {
  const warnings: string[] = [];
  const value = input.propertyValue ?? input.purchasePrice ?? 0;
  const annualNOI = input.annualNOI ?? input.noi ?? 0;
  const capRatePercent = value > 0 ? (annualNOI / value) * 100 : 0;
  const estimatedValueFromTargetCapRate = input.targetCapRatePercent > 0 ? annualNOI / (input.targetCapRatePercent / 100) : null;

  const chartData = [{
    chartType: "bar" as const,
    title: "Cap rate vs target",
    data: {
      labels: ["Cap rate", "Target"],
      datasets: [{
        label: "%",
        data: [round2(capRatePercent), round2(input.targetCapRatePercent)],
        backgroundColor: [capRatePercent >= input.targetCapRatePercent ? "#1f8de0" : "#b44444", "#2b2b2b"]
      }]
    }
  }];

  const interpretationText =
    `Cap rate is ${formatPercent(capRatePercent)} based on NOI of ${formatCurrency(annualNOI)} and value of ${formatCurrency(value)}. ` +
    "Higher cap rate can mean better income or higher risk; don’t use cap rate alone for residential decisions.";

  if (value <= 0) warnings.push("Property value must be greater than 0.");

  return {
    ...baseResult("cap-rate", input.scenarioName),
    summary: [
      metric("capRatePercent", "Cap rate", "percent", capRatePercent),
      metric("annualNOI", "Annual NOI", "currency", annualNOI),
      metric("propertyValue", "Property value", "currency", value)
    ],
    breakdown: { capRatePercent, annualNOI, propertyValue: value, targetCapRatePercent: input.targetCapRatePercent, estimatedValueFromTargetCapRate },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { targetCapRatePercent: input.targetCapRatePercent }
  };
}

// 7) DSCR
const dscrSchema = scenarioSchema.extend({
  annualNOI: money.nonnegative().optional(),
  noi: money.nonnegative().optional(),
  monthlyBondPayment: money.nonnegative().optional(),
  annualDebtService: money.nonnegative().optional()
});

function calcDSCR(input: z.infer<typeof dscrSchema>): CalculatorResult {
  const warnings: string[] = [];
  const annualNOI = input.annualNOI ?? input.noi ?? 0;
  const annualDebtService = input.annualDebtService ?? calculateAnnualDebtService(input.monthlyBondPayment ?? 0);
  const dscr = annualDebtService > 0 ? annualNOI / annualDebtService : 0;
  const safetyBuffer = annualNOI - annualDebtService;
  const classification = dscr < 1 ? "weak" : dscr < 1.25 ? "tight" : "strong";

  const color = dscr < 1 ? "#b44444" : dscr < 1.25 ? "#c7a300" : "#1f8de0";
  const chartData = [{
    chartType: "bar" as const,
    title: "NOI vs debt service (annual)",
    data: {
      labels: ["Annual NOI", "Annual debt service"],
      datasets: [{
        label: "ZAR",
        data: [annualNOI, annualDebtService],
        backgroundColor: [color, "#2b2b2b"]
      }]
    }
  }];

  const interpretationText =
    `DSCR is ${round2(dscr).toFixed(2)}. ` +
    (dscr < 1
      ? "Income does not cover debt payments (weak)."
      : dscr < 1.25
        ? "Coverage is tight—stress-test vacancy and rate increases."
        : "Coverage is strong with a healthy buffer.");

  return {
    ...baseResult("dscr", input.scenarioName),
    summary: [
      metric("dscr", "DSCR", "number", dscr),
      metric("annualNOI", "Annual NOI", "currency", annualNOI),
      metric("annualDebtService", "Annual debt service", "currency", annualDebtService),
      metric("safetyBuffer", "Safety buffer", "currency", safetyBuffer)
    ],
    breakdown: { dscr, annualNOI, annualDebtService, safetyBuffer, classification },
    interpretation: { text: interpretationText, classification: classification === "tight" ? "tight" : classification, warnings },
    chartData,
    assumptionsUsed: { annualDebtServiceDerivedFromMonthly: input.annualDebtService === undefined }
  };
}

// 8) IRR — NPV(r) = Σ CFₜ/(1+r)ᵗ = 0; CF₀ = −cash invested; final year includes operating + net sale proceeds.
function expandAnnualFlowsToHorizon(annualCashFlows: number[], H: number): number[] {
  if (H < 1) return [];
  const out: number[] = [];
  for (let y = 0; y < H; y++) {
    const v = annualCashFlows[y] ?? annualCashFlows[annualCashFlows.length - 1] ?? 0;
    out.push(v);
  }
  return out;
}

const irrSchema = scenarioSchema.extend({
  holdPeriodYears: z.number().int().min(1).max(50),
  /** Legacy exit mode only — growth mode uses estimatedSellingCostPercent. */
  sellingCostsPercent: percent.min(0).max(40).optional(),

  initialCashInvested: money.optional(),
  annualCashFlows: z.array(money).optional(),
  expectedSalePrice: money.nonnegative().optional(),
  remainingLoanBalanceAtSale: money.nonnegative().optional().default(0),

  totalCashInvested: money.nonnegative().optional(),
  annualCashFlowAfterExpensesAndDebt: money.optional(),
  currentEstimatedValue: money.nonnegative().optional(),
  outstandingBondBalance: money.nonnegative().optional(),
  expectedAnnualAppreciationPercent: percent.optional(),
  estimatedSellingCostPercent: percent.min(0).max(40).optional(),
  projectedBondBalanceAtSale: money.nonnegative().optional(),
  cashFlowGrowthPercentAnnual: percent.optional().default(0),
  rentGrowthPercent: percent.optional(),
  expenseGrowthPercent: percent.optional()
});

type IrrParsed = z.infer<typeof irrSchema>;

function calcIRR(input: IrrParsed): CalculatorResult {
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const H = input.holdPeriodYears;

  const growthMode =
    input.currentEstimatedValue != null && input.totalCashInvested != null && input.currentEstimatedValue > 0;

  if (growthMode) {
    return calcIrrGrowthFromValue(input, H, warnings, assumptions);
  }
  return calcIrrLegacySalePrice(input, H, warnings, assumptions);
}

function operatingGrowthRatePerYear(input: IrrParsed): number {
  const rentG = input.rentGrowthPercent;
  const expG = input.expenseGrowthPercent;
  const flatG = input.cashFlowGrowthPercentAnnual ?? 0;
  if (rentG != null || expG != null) {
    const r = rentG ?? 0;
    const e = expG ?? 0;
    if (rentG != null && expG == null) return r / 100;
    if (expG != null && rentG == null) return e / 100;
    return (r + e) / 200;
  }
  return flatG / 100;
}

function calcIrrGrowthFromValue(input: IrrParsed, H: number, warnings: string[], assumptions: string[]): CalculatorResult {
  const tcRaw = input.totalCashInvested!;
  if (tcRaw <= 0) {
    warnings.push("IRR cannot be calculated because total cash invested is zero.");
    return irrEmptyResult(input, warnings, assumptions, [], null, null, null, null, null, null);
  }

  const value0 = input.currentEstimatedValue!;
  if (value0 <= 0 || !Number.isFinite(value0)) {
    warnings.push("IRR requires property value, holding period, cash invested and expected exit value assumptions.");
    return irrEmptyResult(input, warnings, assumptions, [], null, null, null, null, null, null);
  }

  if (!Number.isFinite(H) || H < 1) {
    warnings.push("IRR requires property value, holding period, cash invested and expected exit value assumptions.");
    return irrEmptyResult(input, warnings, assumptions, [], null, null, null, null, null, null);
  }

  const appreciation = input.expectedAnnualAppreciationPercent ?? 0;
  const sellPct = clamp(input.estimatedSellingCostPercent ?? 5, 0, 100);
  const outstanding = input.outstandingBondBalance ?? 0;
  const usedProjectedBond = input.projectedBondBalanceAtSale != null;
  const bondAtSale = usedProjectedBond ? input.projectedBondBalanceAtSale! : outstanding;

  if (!usedProjectedBond) {
    warnings.push(
      "Using current bond balance as estimated future bond balance. Add amortisation details for a more accurate IRR."
    );
  }

  const futurePropertyValue = value0 * Math.pow(1 + appreciation / 100, H);
  const sellingCosts = futurePropertyValue * (sellPct / 100);
  const netSaleProceeds = futurePropertyValue - sellingCosts - bondAtSale;
  const g = operatingGrowthRatePerYear(input);
  const baseAnnual = input.annualCashFlowAfterExpensesAndDebt ?? 0;

  assumptions.push(`Future value (exit) = current estimated value × (1 + appreciation)ᴴ (${appreciation}% p.a.).`);
  assumptions.push(`Selling costs = ${sellPct}% × future property value.`);
  assumptions.push(
    usedProjectedBond
      ? `Bond at sale = projected balance (${bondAtSale}).`
      : `Bond at sale = outstanding bond (${bondAtSale}) — conservative snapshot until amortisation is supplied.`
  );
  assumptions.push(`Operating cash grows at implied annual factor ${(g * 100).toFixed(2)}% on prior-year net operating cash.`);

  const cashFlows: number[] = [-tcRaw];
  for (let y = 1; y < H; y++) {
    cashFlows.push(baseAnnual * Math.pow(1 + g, y - 1));
  }
  const finalOperating = baseAnnual * Math.pow(1 + g, H - 1);
  const finalYearCashFlow = finalOperating + netSaleProceeds;
  cashFlows.push(finalYearCashFlow);

  const futureAllNonPositive = cashFlows.slice(1).every((x) => x <= 0);
  if (futureAllNonPositive) {
    warnings.push("IRR cannot be calculated because there are no positive future cash flows.");
    return irrEmptyResult(
      input,
      warnings,
      assumptions,
      cashFlows,
      futurePropertyValue,
      sellingCosts,
      bondAtSale,
      netSaleProceeds,
      finalYearCashFlow,
      null
    );
  }

  const irrRate = solveIrrPeriodicCashFlows(cashFlows);
  const irrPercent = irrRate === null ? null : Math.round(irrRate * 100 * 100) / 100;

  if (irrPercent === null) {
    warnings.push("Insufficient data to calculate IRR (no discount rate found where NPV = 0 for these cash flows).");
  }

  const irrRes = calculateIRR({ cashFlows });
  const totalProfit = cashFlows.reduce((s, x) => s + x, 0);
  const equityMultiple = tcRaw !== 0 ? cashFlows.filter((x) => x > 0).reduce((s, x) => s + x, 0) / tcRaw : null;

  const interpretationText =
    irrPercent === null ? "Insufficient data — IRR could not be computed." : `IRR is ${formatPercent(irrPercent)} (annual).`;

  const chartData = irrChartData(cashFlows);

  return {
    ...baseResult("irr", input.scenarioName),
    summary: [
      metric("irrPercent", "IRR", "percent", irrPercent),
      metric("equityMultiple", "Equity multiple", "number", equityMultiple ?? 0),
      metric("totalProfit", "Total profit", "currency", totalProfit),
      metric("netSaleProceeds", "Net sale proceeds", "currency", netSaleProceeds)
    ],
    breakdown: {
      irrPercent,
      cashFlows,
      futurePropertyValue,
      sellingCosts,
      bondBalanceAtSale: bondAtSale,
      netSaleProceeds,
      finalYearCashFlow,
      assumptions,
      warnings,
      holdPeriodYears: H,
      irr: irrRate,
      iterations: irrRes.iterations,
      equityMultiple,
      totalProfit,
      averageAnnualCashFlow: baseAnnual,
      appreciationPercentUsed: appreciation,
      bondBasis: usedProjectedBond ? "projected" : "outstanding_snapshot"
    },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: {
      appreciationPercentUsed: appreciation,
      estimatedSellingCostPercent: sellPct,
      holdingPeriodYears: H,
      bondBalanceBasis: usedProjectedBond ? "projectedBondBalanceAtSale" : "outstandingBondBalance"
    }
  };
}

function calcIrrLegacySalePrice(input: IrrParsed, H: number, warnings: string[], assumptions: string[]): CalculatorResult {
  if (input.initialCashInvested === undefined || input.annualCashFlows === undefined || !input.annualCashFlows.length) {
    throw new Error("IRR (legacy mode) requires initialCashInvested and at least one annual cash flow value.");
  }
  if (input.expectedSalePrice === undefined) {
    throw new Error("IRR (legacy mode) requires expectedSalePrice, or use growth mode with currentEstimatedValue and totalCashInvested.");
  }

  const cf0Raw = input.initialCashInvested;
  const cf0 = cf0Raw > 0 ? -Math.abs(cf0Raw) : cf0Raw;
  if (cf0 >= 0) warnings.push("Initial cash invested should be negative (cash outflow); normalized using −abs(value).");

  const saleCosts = input.expectedSalePrice * (clamp(input.sellingCostsPercent ?? 5, 0, 100) / 100);
  const remainingLoan = input.remainingLoanBalanceAtSale ?? 0;
  const netSaleProceeds = input.expectedSalePrice - saleCosts - remainingLoan;
  const series = expandAnnualFlowsToHorizon(input.annualCashFlows, H);

  const cashFlows: number[] = [cf0];
  for (let y = 1; y < H; y++) {
    cashFlows.push(series[y - 1]);
  }
  cashFlows.push(series[H - 1] + netSaleProceeds);

  assumptions.push("Legacy inputs: exit uses explicit expected sale price (not compounded current value).");

  const futureAllNonPositive = cashFlows.slice(1).every((x) => x <= 0);
  if (futureAllNonPositive) {
    warnings.push("IRR cannot be calculated because there are no positive future cash flows.");
  }

  const irrRate = futureAllNonPositive ? null : solveIrrPeriodicCashFlows(cashFlows);
  const irrPercent = irrRate === null ? null : Math.round(irrRate * 100 * 100) / 100;
  const irrRes = calculateIRR({ cashFlows });

  if (irrPercent === null && !futureAllNonPositive) {
    warnings.push("Insufficient data to calculate IRR (no discount rate found where NPV = 0 for these cash flows).");
  }

  const totalProfit = cashFlows.reduce((s, x) => s + x, 0);
  const denom = Math.abs(cf0);
  const equityMultiple = denom !== 0 ? cashFlows.filter((x) => x > 0).reduce((s, x) => s + x, 0) / denom : null;
  const avgAnnual = input.annualCashFlows.length ? input.annualCashFlows.reduce((s, x) => s + x, 0) / input.annualCashFlows.length : 0;

  const interpretationText =
    irrPercent === null ? "Insufficient data — IRR could not be computed." : `IRR is ${formatPercent(irrPercent)} (annual).`;

  return {
    ...baseResult("irr", input.scenarioName),
    summary: [
      metric("irrPercent", "IRR", "percent", irrPercent),
      metric("equityMultiple", "Equity multiple", "number", equityMultiple ?? 0),
      metric("totalProfit", "Total profit", "currency", totalProfit),
      metric("netSaleProceeds", "Net sale proceeds", "currency", netSaleProceeds)
    ],
    breakdown: {
      irrPercent,
      cashFlows,
      futurePropertyValue: null,
      sellingCosts: saleCosts,
      bondBalanceAtSale: remainingLoan,
      netSaleProceeds,
      finalYearCashFlow: cashFlows[cashFlows.length - 1] ?? null,
      assumptions,
      warnings,
      holdPeriodYears: H,
      expectedSalePrice: input.expectedSalePrice,
      irr: irrRate,
      iterations: irrRes.iterations,
      equityMultiple,
      totalProfit,
      averageAnnualCashFlow: avgAnnual
    },
    interpretation: { text: interpretationText, warnings },
    chartData: irrChartData(cashFlows),
    assumptionsUsed: { sellingCostsPercent: input.sellingCostsPercent }
  };
}

function irrChartData(cashFlows: number[]) {
  return [
    {
      chartType: "bar" as const,
      title: "Annual cash flow",
      data: {
        labels: cashFlows.map((_, i) => `Y${i}`),
        datasets: [{ label: "ZAR", data: cashFlows.map((x) => round2(x)), backgroundColor: "#007acc" }]
      }
    },
    {
      chartType: "line" as const,
      title: "Cumulative cash flow",
      data: {
        labels: cashFlows.map((_, i) => `Y${i}`),
        datasets: [
          {
            label: "Cumulative",
            data: cashFlows.reduce((acc: number[], x) => {
              const prev = acc.length ? acc[acc.length - 1] : 0;
              acc.push(round2(prev + x));
              return acc;
            }, []),
            borderColor: "#007acc"
          }
        ]
      }
    }
  ];
}

function irrEmptyResult(
  input: IrrParsed,
  warnings: string[],
  assumptions: string[],
  cashFlows: number[],
  futurePropertyValue: number | null,
  sellingCosts: number | null,
  bondBalanceAtSale: number | null,
  netSaleProceeds: number | null,
  finalYearCashFlow: number | null,
  irrPercent: number | null
): CalculatorResult {
  const chartData = cashFlows.length ? irrChartData(cashFlows) : [];
  return {
    ...baseResult("irr", input.scenarioName),
    summary: [
      metric("irrPercent", "IRR", "percent", irrPercent),
      metric("equityMultiple", "Equity multiple", "number", 0),
      metric("totalProfit", "Total profit", "currency", cashFlows.reduce((s, x) => s + x, 0)),
      metric("netSaleProceeds", "Net sale proceeds", "currency", netSaleProceeds ?? 0)
    ],
    breakdown: {
      irrPercent,
      cashFlows,
      futurePropertyValue,
      sellingCosts,
      bondBalanceAtSale,
      netSaleProceeds,
      finalYearCashFlow,
      assumptions,
      warnings,
      holdPeriodYears: input.holdPeriodYears
    },
    interpretation: { text: "Insufficient data — IRR could not be computed.", warnings },
    chartData,
    assumptionsUsed: {}
  };
}

// 9) BRRRR
const brrrrSchema = scenarioSchema.extend({
  purchasePrice: money.nonnegative(),
  rehabCost: money.nonnegative(),
  transferAndBondCosts: money.nonnegative().default(0),
  afterRepairValue: money.nonnegative(),
  refinanceLTVPercent: percent.min(0).max(100).default(75),
  originalLoanPayoff: money.nonnegative().default(0),
  rentMonthly: money.nonnegative().default(0),
  vacancyRatePercent: percent.min(0).max(100).default(0),
  monthlyOperatingExpenses: money.nonnegative().default(0),
  newInterestRate: percent.min(0).max(100).default(11),
  loanTermYears: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(25), z.literal(30)]).default(20)
});

function calcBRRRR(input: z.infer<typeof brrrrSchema>): CalculatorResult {
  const warnings: string[] = [];
  const totalProjectCost = input.purchasePrice + input.rehabCost + input.transferAndBondCosts;
  const refinanceAmount = input.afterRepairValue * (clamp(input.refinanceLTVPercent, 0, 100) / 100);
  const cashRecovered = refinanceAmount - input.originalLoanPayoff;
  const cashLeftInDeal = totalProjectCost - cashRecovered;
  const forcedEquity = input.afterRepairValue - totalProjectCost;

  const { monthlyPayment } = calculateMonthlyBondPayment({
    principal: refinanceAmount,
    annualInterestRatePercent: input.newInterestRate,
    termYears: input.loanTermYears
  });

  const grossMonthlyIncome = input.rentMonthly;
  const vacancyLoss = grossMonthlyIncome * (clamp(input.vacancyRatePercent, 0, 100) / 100);
  const cf = calculateCashFlow({
    grossMonthlyIncome,
    vacancyLossMonthly: vacancyLoss,
    monthlyOperatingExpenses: input.monthlyOperatingExpenses,
    monthlyDebtService: monthlyPayment
  });
  const cashOnCashAfterRefi = cashLeftInDeal > 0 ? (cf.annualCashFlow / cashLeftInDeal) * 100 : 0;

  const dealRating =
    cashLeftInDeal <= 0 ? "very-strong" : cashOnCashAfterRefi >= 12 ? "very-strong" : cashOnCashAfterRefi >= 8 ? "strong" : cashOnCashAfterRefi >= 5 ? "acceptable" : "weak";
  if (cashLeftInDeal <= 0) warnings.push("Cash left in deal is <= 0. This may indicate you recovered all cash (or more) at refinance.");

  const chartData = [{
    chartType: "bar" as const,
    title: "BRRRR bridge",
    data: {
      labels: ["Purchase", "Rehab", "Costs", "ARV", "Refinance", "Cash left"],
      datasets: [{
        label: "ZAR",
        data: [input.purchasePrice, input.rehabCost, input.transferAndBondCosts, input.afterRepairValue, refinanceAmount, cashLeftInDeal],
        backgroundColor: "#007acc"
      }]
    }
  }];

  const interpretationText =
    `Total project cost is ${formatCurrency(totalProjectCost)}. Forced equity is ${formatCurrency(forcedEquity)}. ` +
    `After refinancing at ${round2(input.refinanceLTVPercent).toFixed(2)}% LTV, cash left in the deal is ${formatCurrency(cashLeftInDeal)} and cash-on-cash after refi is ${formatPercent(cashOnCashAfterRefi)}.`;

  return {
    ...baseResult("brrrr", input.scenarioName),
    summary: [
      metric("cashLeftInDeal", "Cash left in deal", "currency", cashLeftInDeal),
      metric("cashOnCashAfterRefi", "CoC after refinance", "percent", cashOnCashAfterRefi),
      metric("forcedEquity", "Forced equity", "currency", forcedEquity),
      metric("monthlyCashFlowAfterRefi", "Monthly cash flow after refi", "currency", cf.monthlyCashFlow)
    ],
    breakdown: {
      totalProjectCost,
      refinanceAmount,
      cashRecovered,
      cashLeftInDeal,
      forcedEquity,
      newMonthlyBondPayment: monthlyPayment,
      cashFlowAfterRefinance: cf,
      cashOnCashAfterRefi,
      dealRating
    },
    interpretation: { text: interpretationText, classification: dealRating as any, warnings },
    chartData,
    assumptionsUsed: { refinanceLTVPercent: input.refinanceLTVPercent }
  };
}

// 10) Short-term rental / Airbnb
const strSchema = scenarioSchema.extend({
  averageDailyRate: money.nonnegative(),
  occupancyRatePercent: percent.min(0).max(100),
  availableNightsPerMonth: z.number().int().min(1).max(31).default(30),
  cleaningFeePerStay: money.nonnegative().default(0),
  averageStayLength: z.number().min(1).max(30).default(3),
  platformFeePercent: percent.min(0).max(30).default(3),
  managementFeePercent: percent.min(0).max(50).default(0),
  suppliesMonthly: money.nonnegative().default(0),
  utilitiesMonthly: money.nonnegative().default(0),
  insuranceMonthly: money.nonnegative().default(0),
  ratesAndTaxesMonthly: money.nonnegative().default(0),
  maintenanceMonthly: money.nonnegative().default(0),
  furnishingCost: money.nonnegative().default(0),
  monthlyDebtService: money.nonnegative().default(0)
});

function calcShortTermRental(input: z.infer<typeof strSchema>): CalculatorResult {
  const warnings: string[] = [];
  const bookedNights = input.availableNightsPerMonth * (clamp(input.occupancyRatePercent, 0, 100) / 100);
  const grossRoomRevenue = input.averageDailyRate * bookedNights;
  const estimatedStays = bookedNights / input.averageStayLength;
  const cleaningFeeRevenue = input.cleaningFeePerStay * estimatedStays;
  const monthlyGrossRevenue = grossRoomRevenue + cleaningFeeRevenue;
  const revPAR = input.averageDailyRate * (clamp(input.occupancyRatePercent, 0, 100) / 100);

  const platformFees = monthlyGrossRevenue * (clamp(input.platformFeePercent, 0, 100) / 100);
  const managementFees = monthlyGrossRevenue * (clamp(input.managementFeePercent, 0, 100) / 100);
  const monthlyOperatingExpenses =
    input.suppliesMonthly +
    input.utilitiesMonthly +
    input.insuranceMonthly +
    input.ratesAndTaxesMonthly +
    input.maintenanceMonthly +
    platformFees +
    managementFees;

  const netMonthlyCashFlow = monthlyGrossRevenue - monthlyOperatingExpenses - input.monthlyDebtService;
  const annualCashFlow = netMonthlyCashFlow * 12;

  const furnishingPaybackPeriodMonths = netMonthlyCashFlow > 0 ? input.furnishingCost / netMonthlyCashFlow : null;
  const breakEvenOccupancy = input.averageDailyRate > 0 ? (monthlyOperatingExpenses + input.monthlyDebtService) / (input.averageDailyRate * input.availableNightsPerMonth) * 100 : null;

  const chartData = [
    {
      chartType: "line" as const,
      title: "Projected monthly revenue (seasonality example)",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        datasets: [{
          label: "Revenue (example)",
          data: [1.1, 1.05, 1.0, 0.95, 0.92, 0.9, 0.92, 0.95, 1.0, 1.05, 1.1, 1.15].map((m) => round2(monthlyGrossRevenue * m)),
          borderColor: "#007acc"
        }]
      }
    },
    {
      chartType: "doughnut" as const,
      title: "Where revenue goes",
      data: {
        labels: ["Platform fees", "Management fees", "Operating expenses", "Debt service", "Net cash flow"],
        datasets: [{
          label: "ZAR",
          data: [platformFees, managementFees, monthlyOperatingExpenses - platformFees - managementFees, input.monthlyDebtService, Math.max(0, netMonthlyCashFlow)],
          backgroundColor: ["#555555", "#3a3a3a", "#2b2b2b", "#111111", "#007acc"]
        }]
      }
    }
  ];

  const interpretationText =
    `With ADR of ${formatCurrency(input.averageDailyRate)} and occupancy ${formatPercent(input.occupancyRatePercent)}, ` +
    `estimated gross revenue is ${formatCurrency(monthlyGrossRevenue)} per month. Net cash flow after fees/expenses/debt is ${formatCurrency(netMonthlyCashFlow)}.`;

  if (breakEvenOccupancy !== null && breakEvenOccupancy > 100) warnings.push("Break-even occupancy is above 100%. This deal likely cannot break even with current assumptions.");

  return {
    ...baseResult("short-term-rental", input.scenarioName),
    summary: [
      metric("netMonthlyCashFlow", "Net monthly cash flow", "currency", netMonthlyCashFlow),
      metric("monthlyGrossRevenue", "Monthly gross revenue", "currency", monthlyGrossRevenue),
      metric("revPAR", "RevPAR", "currency", revPAR),
      metric("breakEvenOccupancy", "Break-even occupancy", "percent", breakEvenOccupancy ?? 0)
    ],
    breakdown: {
      bookedNights,
      grossRoomRevenue,
      estimatedStays,
      cleaningFeeRevenue,
      monthlyGrossRevenue,
      revPAR,
      platformFees,
      managementFees,
      monthlyOperatingExpenses,
      monthlyDebtService: input.monthlyDebtService,
      netMonthlyCashFlow,
      annualCashFlow,
      furnishingPaybackPeriodMonths,
      breakEvenOccupancy
    },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { seasonality: "Illustrative curve only (not location-specific)." }
  };
}

// 11) 70% rule
const seventySchema = scenarioSchema.extend({
  afterRepairValue: money.nonnegative(),
  estimatedRepairCost: money.nonnegative(),
  desiredProfitMargin: percent.min(0).max(50).default(10),
  sellingCosts: money.nonnegative().default(0),
  holdingCosts: money.nonnegative().default(0)
});

function calcSeventyRule(input: z.infer<typeof seventySchema>): CalculatorResult {
  const warnings: string[] = [];
  const maxOffer70Rule = 0.7 * input.afterRepairValue - input.estimatedRepairCost;
  const desiredProfit = input.afterRepairValue * (input.desiredProfitMargin / 100);
  const customMaxOffer = input.afterRepairValue - input.estimatedRepairCost - input.sellingCosts - input.holdingCosts - desiredProfit;
  const estimatedProfit = input.afterRepairValue - (customMaxOffer + input.estimatedRepairCost + input.sellingCosts + input.holdingCosts);
  const marginOfSafety = input.afterRepairValue > 0 ? (input.afterRepairValue - (customMaxOffer + input.estimatedRepairCost)) / input.afterRepairValue * 100 : 0;

  const chartData = [{
    chartType: "bar" as const,
    title: "ARV allocation (illustrative)",
    data: {
      labels: ["ARV"],
      datasets: [
        { label: "Max offer", data: [round2(customMaxOffer)], backgroundColor: "#007acc", stack: "a" },
        { label: "Repairs", data: [round2(input.estimatedRepairCost)], backgroundColor: "#2b2b2b", stack: "a" },
        { label: "Selling", data: [round2(input.sellingCosts)], backgroundColor: "#3a3a3a", stack: "a" },
        { label: "Holding", data: [round2(input.holdingCosts)], backgroundColor: "#4a4a4a", stack: "a" },
        { label: "Profit buffer", data: [round2(desiredProfit)], backgroundColor: "#555555", stack: "a" }
      ]
    }
  }];

  const interpretationText =
    `70% rule max offer is ${formatCurrency(maxOffer70Rule)}. With your custom profit margin and costs, custom max offer is ${formatCurrency(customMaxOffer)}.`;

  if (customMaxOffer < 0) warnings.push("Custom max offer is negative. Check inputs (costs may exceed ARV).");

  return {
    ...baseResult("70-rule", input.scenarioName),
    summary: [
      metric("maxOffer70Rule", "Max offer (70% rule)", "currency", maxOffer70Rule),
      metric("customMaxOffer", "Custom max offer", "currency", customMaxOffer),
      metric("desiredProfit", "Desired profit", "currency", desiredProfit),
      metric("marginOfSafety", "Margin of safety", "percent", marginOfSafety)
    ],
    breakdown: { maxOffer70Rule, customMaxOffer, desiredProfit, sellingCosts: input.sellingCosts, holdingCosts: input.holdingCosts, estimatedProfit, marginOfSafety },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { seventyPercentRule: true }
  };
}

// 12) Flip profit
const flipSchema = scenarioSchema.extend({
  purchasePrice: money.nonnegative(),
  rehabCost: money.nonnegative(),
  holdingCosts: money.nonnegative().default(0),
  sellingPrice: money.nonnegative(),
  sellingAgentCommissionPercent: percent.min(0).max(10).default(5),
  transferCosts: money.nonnegative().default(0),
  financingCosts: money.nonnegative().default(0),
  contingencyPercent: percent.min(0).max(30).default(10)
});

function calcFlipProfit(input: z.infer<typeof flipSchema>): CalculatorResult {
  const warnings: string[] = [];
  const sellingAgentCommission = input.sellingPrice * (input.sellingAgentCommissionPercent / 100);
  const subtotalCosts = input.purchasePrice + input.rehabCost + input.holdingCosts + sellingAgentCommission + input.transferCosts + input.financingCosts;
  const contingency = subtotalCosts * (input.contingencyPercent / 100);
  const totalProjectCost = subtotalCosts + contingency;
  const netSaleProceeds = input.sellingPrice - sellingAgentCommission;
  const profit = input.sellingPrice - totalProjectCost;
  const totalCashInvested = input.purchasePrice + input.rehabCost + input.holdingCosts + input.transferCosts + input.financingCosts + contingency;
  const roiPercent = totalCashInvested > 0 ? (profit / totalCashInvested) * 100 : 0;
  const profitMarginPercent = input.sellingPrice > 0 ? (profit / input.sellingPrice) * 100 : 0;
  const breakEvenSalePrice = totalProjectCost;

  const chartData = [{
    chartType: "bar" as const,
    title: "Sale price → costs → profit (waterfall-style)",
    data: {
      labels: ["Sale price", "Costs", "Profit"],
      datasets: [{
        label: "ZAR",
        data: [input.sellingPrice, totalProjectCost, profit],
        backgroundColor: ["#007acc", "#2b2b2b", profit >= 0 ? "#1f8de0" : "#b44444"]
      }]
    }
  }];

  const interpretationText =
    `Estimated profit is ${formatCurrency(profit)} with ROI of ${formatPercent(roiPercent)}. Break-even sale price is ${formatCurrency(breakEvenSalePrice)}.`;
  if (profit < 0) warnings.push("Projected profit is negative. Re-check sale price, costs, or contingency.");

  return {
    ...baseResult("flip-profit", input.scenarioName),
    summary: [
      metric("profit", "Profit", "currency", profit),
      metric("roiPercent", "ROI", "percent", roiPercent),
      metric("totalProjectCost", "Total project cost", "currency", totalProjectCost),
      metric("breakEvenSalePrice", "Break-even sale price", "currency", breakEvenSalePrice)
    ],
    breakdown: {
      sellingAgentCommission,
      contingency,
      totalProjectCost,
      netSaleProceeds,
      profit,
      roiPercent,
      profitMarginPercent,
      breakEvenSalePrice
    },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { contingencyPercent: input.contingencyPercent }
  };
}

// 13) Wholesale profit
const wholesaleSchema = scenarioSchema.extend({
  afterRepairValue: money.nonnegative(),
  repairCost: money.nonnegative(),
  desiredInvestorProfit: money.nonnegative().default(0),
  assignmentFee: money.nonnegative().default(0),
  buyerMaxOfferPercent: percent.min(0).max(100).default(70)
});

function calcWholesale(input: z.infer<typeof wholesaleSchema>): CalculatorResult {
  const warnings: string[] = [];
  const buyerMaxOffer = (input.buyerMaxOfferPercent / 100) * input.afterRepairValue - input.repairCost - input.desiredInvestorProfit;
  const yourMaxContractPrice = buyerMaxOffer - input.assignmentFee;
  const spread = buyerMaxOffer - yourMaxContractPrice;
  if (yourMaxContractPrice < 0) warnings.push("Your max contract price is negative—assignment fee and costs may be too high.");
  if (input.assignmentFee > 0.1 * input.afterRepairValue) warnings.push("Assignment fee is large relative to ARV. Ensure the buyer still has margin.");

  const chartData = [{
    chartType: "bar" as const,
    title: "ARV split (stacked)",
    data: {
      labels: ["ARV"],
      datasets: [
        { label: "Repairs", data: [input.repairCost], backgroundColor: "#2b2b2b", stack: "a" },
        { label: "Investor profit", data: [input.desiredInvestorProfit], backgroundColor: "#555555", stack: "a" },
        { label: "Assignment fee", data: [input.assignmentFee], backgroundColor: "#3a3a3a", stack: "a" },
        { label: "Max contract price", data: [yourMaxContractPrice], backgroundColor: "#007acc", stack: "a" }
      ]
    }
  }];

  const interpretationText =
    `Buyer max offer is ${formatCurrency(buyerMaxOffer)}. With assignment fee ${formatCurrency(input.assignmentFee)}, your max contract price is ${formatCurrency(yourMaxContractPrice)}.`;

  return {
    ...baseResult("wholesale-profit", input.scenarioName),
    summary: [
      metric("buyerMaxOffer", "Buyer max offer", "currency", buyerMaxOffer),
      metric("yourMaxContractPrice", "Your max contract price", "currency", yourMaxContractPrice),
      metric("assignmentFee", "Assignment fee", "currency", input.assignmentFee),
      metric("spread", "Spread", "currency", spread)
    ],
    breakdown: { buyerMaxOffer, yourMaxContractPrice, assignmentFee: input.assignmentFee, spread, buyerMaxOfferPercent: input.buyerMaxOfferPercent },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { buyerMaxOfferPercent: input.buyerMaxOfferPercent }
  };
}

// 14) Rehab estimator
const rehabSchema = scenarioSchema.extend({
  contingencyPercent: percent.min(0).max(50).default(10),
  items: z.array(z.object({
    category: z.string().trim().min(1).default("other"),
    description: z.string().trim().min(1).default("Item"),
    quantity: z.number().finite().min(0),
    unitCost: money.nonnegative()
  })).min(1)
});

function calcRehab(input: z.infer<typeof rehabSchema>): CalculatorResult {
  const warnings: string[] = [];
  const lineItems = input.items.map((it) => ({
    ...it,
    lineTotal: it.quantity * it.unitCost
  }));
  const subtotal = lineItems.reduce((s, x) => s + x.lineTotal, 0);
  const contingency = subtotal * (input.contingencyPercent / 100);
  const totalRehabCost = subtotal + contingency;

  const costByCategory: Record<string, number> = {};
  lineItems.forEach((x) => {
    costByCategory[x.category] = (costByCategory[x.category] ?? 0) + x.lineTotal;
  });
  const highest = Object.entries(costByCategory).sort((a, b) => b[1] - a[1])[0] ?? null;

  const chartData = [{
    chartType: "doughnut" as const,
    title: "Rehab cost by category",
    data: {
      labels: Object.keys(costByCategory),
      datasets: [{ label: "ZAR", data: Object.values(costByCategory), backgroundColor: "#007acc" }]
    }
  }];

  const interpretationText =
    `Estimated rehab subtotal is ${formatCurrency(subtotal)}. With contingency ${formatPercent(input.contingencyPercent)}, total rehab cost is ${formatCurrency(totalRehabCost)}.`;

  return {
    ...baseResult("rehab-cost", input.scenarioName),
    summary: [
      metric("totalRehabCost", "Total rehab cost", "currency", totalRehabCost),
      metric("subtotal", "Subtotal", "currency", subtotal),
      metric("contingency", "Contingency", "currency", contingency),
      metric("contingencyPercent", "Contingency %", "percent", input.contingencyPercent)
    ],
    breakdown: { items: lineItems, subtotal, contingency, totalRehabCost, costByCategory, highestCostCategory: highest?.[0] ?? null },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { contingencyPercent: input.contingencyPercent }
  };
}

// 15) Rent-to-cost ratio
const rentCostSchema = scenarioSchema.extend({
  monthlyRent: money.nonnegative(),
  purchasePrice: money.nonnegative(),
  totalAcquisitionCost: money.nonnegative().optional(),
  initialRepairCost: money.nonnegative().optional()
});

function calcRentToCost(input: z.infer<typeof rentCostSchema>): CalculatorResult {
  const warnings: string[] = [];
  const rentToPrice = input.purchasePrice > 0 ? (input.monthlyRent / input.purchasePrice) * 100 : 0;
  const totalCost = input.totalAcquisitionCost ?? (input.purchasePrice + (input.initialRepairCost ?? 0));
  const rentToTotalCost = totalCost > 0 ? (input.monthlyRent / totalCost) * 100 : 0;
  const meets1 = rentToPrice >= 1;
  const meets2 = rentToPrice >= 2;

  const interpretationText =
    `Rent-to-price is ${formatPercent(rentToPrice)}. ` +
    `As a screening tool: >=1% is often workable; >=2% is rare and may signal higher risk or errors.`;
  warnings.push("This is a screening metric only. It ignores vacancy, expenses and financing.");

  const chartData = [{
    chartType: "bar" as const,
    title: "Rent-to-price vs rules of thumb",
    data: {
      labels: ["Actual", "1% rule", "2% rule"],
      datasets: [{ label: "%", data: [rentToPrice, 1, 2], backgroundColor: ["#007acc", "#2b2b2b", "#3a3a3a"] }]
    }
  }];

  return {
    ...baseResult("rent-to-cost-ratio", input.scenarioName),
    summary: [
      metric("rentToPricePercent", "Rent-to-price", "percent", rentToPrice),
      metric("rentToTotalCostPercent", "Rent-to-total-cost", "percent", rentToTotalCost),
      metric("monthlyRent", "Monthly rent", "currency", input.monthlyRent),
      metric("purchasePrice", "Purchase price", "currency", input.purchasePrice)
    ],
    breakdown: { rentToPricePercent: rentToPrice, rentToTotalCostPercent: rentToTotalCost, totalAcquisitionCost: totalCost, meets1PercentRule: meets1, meets2PercentRule: meets2 },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { onePercentRule: 1, twoPercentRule: 2 }
  };
}

// 16) GRM
const grmSchema = scenarioSchema.extend({
  purchasePrice: money.nonnegative(),
  monthlyGrossRent: money.nonnegative(),
  targetGRM: z.number().finite().min(1).max(30).default(10)
});

function calcGRM(input: z.infer<typeof grmSchema>): CalculatorResult {
  const warnings: string[] = [];
  const annualGrossRent = input.monthlyGrossRent * 12;
  const grm = annualGrossRent > 0 ? input.purchasePrice / annualGrossRent : 0;
  const impliedValueAtTargetGRM = input.targetGRM > 0 ? annualGrossRent * input.targetGRM : null;

  const interpretationText =
    `GRM is ${round2(grm).toFixed(2)} (lower is generally better). GRM ignores expenses and financing.`;
  if (annualGrossRent === 0) warnings.push("Annual gross rent is R0. GRM cannot be meaningfully computed.");

  const chartData = [{
    chartType: "bar" as const,
    title: "GRM vs target",
    data: {
      labels: ["GRM", "Target"],
      datasets: [{ label: "Multiple", data: [round2(grm), input.targetGRM], backgroundColor: ["#007acc", "#2b2b2b"] }]
    }
  }];

  return {
    ...baseResult("grm", input.scenarioName),
    summary: [
      metric("grm", "GRM", "number", grm),
      metric("annualGrossRent", "Annual gross rent", "currency", annualGrossRent),
      metric("purchasePrice", "Purchase price", "currency", input.purchasePrice),
      metric("impliedValueAtTargetGRM", "Implied value at target GRM", "currency", impliedValueAtTargetGRM ?? 0)
    ],
    breakdown: { annualGrossRent, grm, targetGRM: input.targetGRM, impliedValueAtTargetGRM },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { targetGRM: input.targetGRM }
  };
}

// 17) LTV
const ltvSchema = scenarioSchema.extend({
  propertyValue: money.nonnegative(),
  loanAmount: money.nonnegative()
});

function calcLTV(input: z.infer<typeof ltvSchema>): CalculatorResult {
  const warnings: string[] = [];
  const ltv = input.propertyValue > 0 ? input.loanAmount / input.propertyValue : 0;
  const ltvPercent = ltv * 100;
  const equity = input.propertyValue - input.loanAmount;
  const risk = ltvPercent < 70 ? "conservative" : ltvPercent <= 80 ? "normal" : "high";

  const chartData = [{
    chartType: "doughnut" as const,
    title: "Loan vs equity",
    data: {
      labels: ["Loan", "Equity"],
      datasets: [{ label: "ZAR", data: [input.loanAmount, Math.max(0, equity)], backgroundColor: ["#007acc", "#2b2b2b"] }]
    }
  }];

  const interpretationText =
    `LTV is ${formatPercent(ltvPercent)} and equity is ${formatCurrency(equity)}. Lower LTV usually improves loan terms.`;

  return {
    ...baseResult("ltv", input.scenarioName),
    summary: [
      metric("ltvPercent", "LTV", "percent", ltvPercent),
      metric("equity", "Equity", "currency", equity),
      metric("loanAmount", "Loan amount", "currency", input.loanAmount),
      metric("propertyValue", "Property value", "currency", input.propertyValue)
    ],
    breakdown: { ltv, ltvPercent, equity, riskClassification: risk },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: {}
  };
}

// 18) DCF
const dcfSchema = scenarioSchema.extend({
  initialInvestment: money.nonnegative(),
  discountRatePercent: percent.min(-50).max(100),
  annualCashFlows: z.array(money).min(1),
  salePriceAtEnd: money.nonnegative().default(0),
  sellingCosts: money.nonnegative().default(0),
  holdPeriodYears: z.number().int().min(1).max(50)
});

function calcDCF(input: z.infer<typeof dcfSchema>): CalculatorResult {
  const warnings: string[] = [];
  const hold = input.holdPeriodYears;
  const flows = input.annualCashFlows.slice(0, hold);
  const final = (flows[hold - 1] ?? 0) + (input.salePriceAtEnd - input.sellingCosts);
  const cashFlows = [-input.initialInvestment, ...flows.slice(0, hold - 1), final];
  const presentValue = calculateNPV({ discountRatePercent: input.discountRatePercent, cashFlows });
  const npv = presentValue;
  const attractive = npv > 0;

  const discountedTable = cashFlows.map((cf, i) => ({
    year: i,
    nominal: cf,
    discounted: cf / (1 + input.discountRatePercent / 100) ** i
  }));

  const chartData = [{
    chartType: "line" as const,
    title: "Nominal vs discounted cash flows",
    data: {
      labels: discountedTable.map((r) => `Y${r.year}`),
      datasets: [
        { label: "Nominal", data: discountedTable.map((r) => round2(r.nominal)), borderColor: "#007acc" },
        { label: "Discounted", data: discountedTable.map((r) => round2(r.discounted)), borderColor: "#2b2b2b" }
      ]
    }
  }];

  const interpretationText =
    `At discount rate ${formatPercent(input.discountRatePercent)}, NPV is ${formatCurrency(npv)}. ` +
    (attractive ? "NPV > 0 may be attractive at this discount rate." : "NPV < 0 may be unattractive at this discount rate.");

  return {
    ...baseResult("dcf", input.scenarioName),
    summary: [
      metric("npv", "NPV", "currency", npv),
      metric("presentValueOfCashFlows", "Present value of cash flows", "currency", presentValue + input.initialInvestment),
      metric("discountRatePercent", "Discount rate", "percent", input.discountRatePercent),
      metric("initialInvestment", "Initial investment", "currency", input.initialInvestment)
    ],
    breakdown: { cashFlows, discountedTable, npv, investmentDecision: attractive ? "potentially attractive" : "unattractive" },
    interpretation: { text: interpretationText, warnings },
    chartData,
    assumptionsUsed: { holdPeriodYears: hold }
  };
}

// Extras: Operating expense ratio
const oerSchema = scenarioSchema.extend({
  annualOperatingExpenses: money.nonnegative(),
  annualGrossIncome: money.nonnegative()
});
function calcOER(input: z.infer<typeof oerSchema>): CalculatorResult {
  const warnings: string[] = [];
  const ratio = input.annualGrossIncome > 0 ? (input.annualOperatingExpenses / input.annualGrossIncome) * 100 : 0;
  const interpretationText = `Operating expense ratio is ${formatPercent(ratio)}. Lower can indicate better operating efficiency, but verify expense completeness.`;
  return {
    ...baseResult("operating-expense-ratio", input.scenarioName),
    summary: [
      metric("operatingExpenseRatioPercent", "Operating expense ratio", "percent", ratio),
      metric("annualOperatingExpenses", "Annual operating expenses", "currency", input.annualOperatingExpenses),
      metric("annualGrossIncome", "Annual gross income", "currency", input.annualGrossIncome)
    ],
    breakdown: { ratioPercent: ratio },
    interpretation: { text: interpretationText, warnings },
    chartData: [],
    assumptionsUsed: {}
  };
}

// Buy vs Rent (simple free-user comparison)
const buyVsRentSchema = scenarioSchema
  .extend({
    purchasePrice: money.positive(),
    monthlyRent: money.nonnegative(),
    depositAmount: money.nonnegative(),
    interestRate: percent.min(0).max(30).default(11.75),
    analysisYears: z.coerce.number().int().min(5).max(30),
    propertyAppreciation: percent.min(-20).max(30).default(5),
    rentEscalation: percent.min(0).max(30).default(6)
  })
  .superRefine((data, ctx) => {
    if (data.depositAmount >= data.purchasePrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Deposit must be less than the property price",
        path: ["depositAmount"]
      });
    }
  });

function calcBuyVsRent(input: z.infer<typeof buyVsRentSchema>): CalculatorResult {
  const core = runSimpleBuyVsRentCalculator({
    purchasePrice: input.purchasePrice,
    monthlyRent: input.monthlyRent,
    depositAmount: input.depositAmount,
    interestRate: input.interestRate,
    analysisYears: Math.round(input.analysisYears),
    propertyAppreciation: input.propertyAppreciation,
    rentEscalation: input.rentEscalation,
    scenarioName: input.scenarioName
  });
  return mapSimpleBuyVsRentToCalculatorResult(core, input.scenarioName);
}

// Extras: Square footage / area
const areaSchema = scenarioSchema.extend({
  length: z.number().finite().nonnegative(),
  width: z.number().finite().nonnegative()
});

const grossYieldSchema = scenarioSchema.extend({
  purchasePrice: money.positive(),
  monthlyGrossRent: money.nonnegative(),
  otherMonthlyIncome: money.nonnegative().default(0)
});

function calcGrossYield(input: z.infer<typeof grossYieldSchema>): CalculatorResult {
  const annualGrossRent = (input.monthlyGrossRent + input.otherMonthlyIncome) * 12;
  const grossYield = calculateGrossYield({ annualGrossRent, price: input.purchasePrice });
  const grm = annualGrossRent > 0 ? input.purchasePrice / annualGrossRent : 0;
  const interpretationText = `Gross yield is ${formatPercent(grossYield)} on a price of ${formatCurrency(input.purchasePrice)}.`;
  return {
    ...baseResult("gross-yield", input.scenarioName),
    summary: [
      metric("grossYield", "Gross yield", "percent", grossYield),
      metric("annualGrossRent", "Annual gross rent", "currency", annualGrossRent),
      metric("grm", "GRM (from gross rent)", "number", grm)
    ],
    breakdown: { grossYield, annualGrossRent, grm, purchasePrice: input.purchasePrice },
    interpretation: { text: interpretationText, warnings: [] },
    chartData: [],
    assumptionsUsed: { excludesVacancyAndOpex: true }
  };
}

const yieldOnCostSchema = scenarioSchema.extend({
  stabilisedNOI: money.nonnegative(),
  totalProjectCost: money.positive()
});

function calcYieldOnCost(input: z.infer<typeof yieldOnCostSchema>): CalculatorResult {
  const yoc = calculateYieldOnCost({
    stabilisedNOI: input.stabilisedNOI,
    totalProjectCost: input.totalProjectCost
  });
  const interpretationText = `Yield on cost is ${formatPercent(yoc)} — stabilised NOI relative to total project cost.`;
  return {
    ...baseResult("yield-on-cost", input.scenarioName),
    summary: [
      metric("yieldOnCost", "Yield on cost", "percent", yoc),
      metric("stabilisedNOI", "Stabilised NOI", "currency", input.stabilisedNOI),
      metric("totalProjectCost", "Total project cost", "currency", input.totalProjectCost)
    ],
    breakdown: { yieldOnCost: yoc },
    interpretation: { text: interpretationText, warnings: [] },
    chartData: [],
    assumptionsUsed: { capRateOnCostBasis: true }
  };
}

const debtYieldSchema = scenarioSchema.extend({
  annualNOI: money.nonnegative(),
  loanAmount: money.positive()
});

function calcDebtYield(input: z.infer<typeof debtYieldSchema>): CalculatorResult {
  const debtYield = calculateDebtYield({ annualNOI: input.annualNOI, loanAmount: input.loanAmount });
  const interpretationText = `Debt yield is ${formatPercent(debtYield)} — NOI relative to loan amount (lender screen).`;
  return {
    ...baseResult("debt-yield", input.scenarioName),
    summary: [
      metric("debtYield", "Debt yield", "percent", debtYield),
      metric("annualNOI", "Annual NOI", "currency", input.annualNOI),
      metric("loanAmount", "Loan amount", "currency", input.loanAmount)
    ],
    breakdown: { debtYield },
    interpretation: { text: interpretationText, warnings: [] },
    chartData: [],
    assumptionsUsed: { usesNOIBeforeDebt: true }
  };
}

const breakEvenOccupancySchema = scenarioSchema.extend({
  grossPotentialIncomeAnnual: money.nonnegative(),
  annualOperatingExpenses: money.nonnegative(),
  annualDebtService: money.nonnegative()
});

function calcBreakEvenOccupancy(input: z.infer<typeof breakEvenOccupancySchema>): CalculatorResult {
  const breakEven = calculateBreakEvenOccupancy({
    grossPotentialIncome: input.grossPotentialIncomeAnnual,
    annualOperatingExpenses: input.annualOperatingExpenses,
    annualDebtService: input.annualDebtService
  });
  const warnings: string[] = [];
  if (breakEven > 100) warnings.push("Break-even occupancy exceeds 100% — costs exceed gross potential income at full occupancy.");
  const interpretationText = `Break-even occupancy is ${formatPercent(breakEven)} — the occupancy needed for pre-tax cash flow to reach zero (all inputs annual).`;
  return {
    ...baseResult("break-even-occupancy", input.scenarioName),
    summary: [
      metric("breakEvenOccupancy", "Break-even occupancy", "percent", breakEven),
      metric("grossPotentialIncomeAnnual", "Gross potential income (annual)", "currency", input.grossPotentialIncomeAnnual),
      metric("totalCosts", "Opex + debt service (annual)", "currency", input.annualOperatingExpenses + input.annualDebtService)
    ],
    breakdown: { breakEvenOccupancy: breakEven },
    interpretation: { text: interpretationText, warnings },
    chartData: [],
    assumptionsUsed: { timeBase: "Annual GPI, opex and debt service." }
  };
}

const loanConstantSchema = scenarioSchema.extend({
  loanAmount: money.positive(),
  monthlyBondPayment: money.nonnegative().optional(),
  annualDebtService: money.nonnegative().optional()
});

function calcLoanConstant(input: z.infer<typeof loanConstantSchema>): CalculatorResult {
  const lc = calculateLoanConstant({
    loanAmount: input.loanAmount,
    monthlyBondPayment: input.monthlyBondPayment,
    annualDebtService: input.annualDebtService
  });
  const interpretationText = `Loan constant is ${formatPercent(lc.loanConstantPercent)} — annual debt service as a percentage of loan amount.`;
  return {
    ...baseResult("loan-constant", input.scenarioName),
    summary: [
      metric("loanConstant", "Loan constant", "percent", lc.loanConstantPercent),
      metric("annualDebtService", "Annual debt service", "currency", lc.annualDebtService),
      metric("loanAmount", "Loan amount", "currency", input.loanAmount)
    ],
    breakdown: { loanConstantPercent: lc.loanConstantPercent, annualDebtService: lc.annualDebtService },
    interpretation: { text: interpretationText, warnings: [] },
    chartData: [],
    assumptionsUsed: { derivedFromMonthlyWhenNeeded: input.annualDebtService === undefined }
  };
}

function calcArea(input: z.infer<typeof areaSchema>): CalculatorResult {
  const warnings: string[] = [];
  const areaSqm = input.length * input.width;
  const areaSqft = areaSqm * 10.7639;
  const interpretationText = `Area is ${round2(areaSqm)} m² (${round2(areaSqft)} ft²). Built-up includes walls; carpet is usable internal area; super built-up includes common area share.`;
  return {
    ...baseResult("square-footage", input.scenarioName),
    summary: [
      metric("areaSqm", "Area (m²)", "number", areaSqm),
      metric("areaSqft", "Area (ft²)", "number", areaSqft)
    ],
    breakdown: {
      areaSqm,
      areaSqft,
      definitions: {
        builtUp: "Total constructed area including walls.",
        carpet: "Usable internal floor area.",
        superBuiltUp: "Built-up area plus common area share."
      }
    },
    interpretation: { text: interpretationText, warnings },
    chartData: [],
    assumptionsUsed: { conversionSqmToSqft: 10.7639 }
  };
}

export function calculate(type: string, input: AnyInput): CalculatorResult {
  switch (type) {
    case "transfer-bond-costs":
      return calcTransferBondCosts(transferBondSchema.parse(input));
    case "monthly-payment":
      return calcMonthlyBond(monthlyBondSchema.parse(input));
    case "cash-flow":
      return calcCashFlow(cashFlowSchema.parse(input));
    case "cash-on-cash-return":
      return calcCashOnCash(cocSchema.parse(input));
    case "noi":
      return calcNOI(noiSchema.parse(input));
    case "cap-rate":
      return calcCapRate(capRateSchema.parse(input));
    case "dscr":
      return calcDSCR(dscrSchema.parse(input));
    case "irr":
      return calcIRR(irrSchema.parse(input));
    case "brrrr":
      return calcBRRRR(brrrrSchema.parse(input));
    case "short-term-rental":
      return calcShortTermRental(strSchema.parse(input));
    case "70-rule":
      return calcSeventyRule(seventySchema.parse(input));
    case "flip-profit":
      return calcFlipProfit(flipSchema.parse(input));
    case "wholesale-profit":
      return calcWholesale(wholesaleSchema.parse(input));
    case "rehab-cost":
      return calcRehab(rehabSchema.parse(input));
    case "rent-to-cost-ratio":
      return calcRentToCost(rentCostSchema.parse(input));
    case "grm":
      return calcGRM(grmSchema.parse(input));
    case "ltv":
      return calcLTV(ltvSchema.parse(input));
    case "dcf":
      return calcDCF(dcfSchema.parse(input));
    case "operating-expense-ratio":
      return calcOER(oerSchema.parse(input));
    case "square-footage":
      return calcArea(areaSchema.parse(input));
    case "buy-vs-rent":
      return calcBuyVsRent(buyVsRentSchema.parse(input));
    case "gross-yield":
      return calcGrossYield(grossYieldSchema.parse(input));
    case "yield-on-cost":
      return calcYieldOnCost(yieldOnCostSchema.parse(input));
    case "debt-yield":
      return calcDebtYield(debtYieldSchema.parse(input));
    case "break-even-occupancy":
      return calcBreakEvenOccupancy(breakEvenOccupancySchema.parse(input));
    case "loan-constant":
      return calcLoanConstant(loanConstantSchema.parse(input));
    default:
      throw new Error(`Unsupported calculator type: ${type}`);
  }
}
