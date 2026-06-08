/**
 * Assembles PropertyInvestmentReportModel from calculator INVESTMENT_REPORT payload.
 */

import {
  buildCalculatorIncomeExpenseRows,
  buildCalculatorLoanAssumptionRows,
  buildCalculatorPropertyInformationRows
} from "./pdf/reportDisplayMapper.js";
import { computeCashOnCashRoiPercent, resolveTotalCashInvested } from "./propertyCalculator/financialMetrics.js";
import {
  calculateIRRByProjectionYear,
  resolveDefaultIrr,
  type IrrByYearEntry
} from "./propertyCalculatorServer.js";
import {
  buildExecutiveSummary,
  derivePdfInvestmentRating
} from "./reportInvestmentRating.js";
import {
  buildAnnualProjectionRows,
  buildFiftyPercentBondRuleRows,
  computeMonthlyFinancials,
  resolveOperatingExpenses
} from "./reportFinancialAssembly.js";
import {
  buildCashInvestmentRows,
  formatPct,
  formatZar,
  PROJECTION_YEAR_COLUMNS,
  type PropertyInvestmentReportModel
} from "./propertyInvestmentReportData.js";

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Gross rent from calculator answers; metrics.monthlyIncome is often effective (post-vacancy). */
function resolveCalculatorGrossMonthlyIncome(
  answers: Record<string, unknown>,
  metricsIncome: number
): number {
  const rent = parseNum(answers.monthlyRent);
  if (rent != null && rent > 0) return rent;
  const unitSum =
    (parseNum(answers.unit1Rent) ?? 0) +
    (parseNum(answers.unit2Rent) ?? 0) +
    (parseNum(answers.unit3Rent) ?? 0) +
    (parseNum(answers.unit4Rent) ?? 0);
  if (unitSum > 0) return unitSum;
  const vacancyPct = parseNum(answers.vacancyAllowancePct);
  if (metricsIncome > 0 && vacancyPct != null && vacancyPct > 0 && vacancyPct < 100) {
    return metricsIncome / (1 - vacancyPct / 100);
  }
  return metricsIncome;
}

function propertyTypeLabel(id: string): string {
  const map: Record<string, string> = {
    "single-family": "Single-family home",
    multifamily: "Multifamily",
    condo: "Condo / townhouse",
    commercial: "Commercial",
    land: "Land",
    "short-term-rental": "Short-term rental"
  };
  return map[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function assembleCalculatorInvestmentReportData(opts: {
  propertyType: string;
  answers: Record<string, unknown>;
  metrics: Record<string, unknown>;
  generatedAt?: Date;
  projectionAssumptions?: {
    annualIncomeGrowthPercentAnnual?: number | null;
    expenseGrowthPercentAnnual?: number | null;
    propertyAppreciationPercentAnnual?: number | null;
  } | null;
}): PropertyInvestmentReportModel {
  const now = opts.generatedAt ?? new Date();
  const answers = opts.answers ?? {};
  const metrics = opts.metrics ?? {};
  const typeLabel = propertyTypeLabel(String(opts.propertyType || "").trim() || "Property");

  const metricsIncome = parseNum(metrics.monthlyIncome) ?? 0;
  const monthlyGrossIncome = resolveCalculatorGrossMonthlyIncome(answers, metricsIncome);
  const monthlyIncome = monthlyGrossIncome;
  const monthlyLoanPayment = parseNum(metrics.monthlyBondPayment) ?? 0;
  const rates = parseNum(answers.ratesTaxesMonthly) ?? 0;
  const insurance = parseNum(answers.insuranceMonthly) ?? 0;
  const maintenance = parseNum(answers.maintenanceReserveMonthly) ?? 0;
  const hoa = parseNum(answers.hoaLeviesMonthly) ?? 0;
  const utilities = parseNum(answers.utilitiesMonthly) ?? 0;
  const mgmtPct = parseNum(answers.managementFeePct);
  const mgmtMonthly = mgmtPct != null && monthlyGrossIncome > 0 ? (monthlyGrossIncome * mgmtPct) / 100 : 0;
  const lineItemOperating = rates + insurance + maintenance + hoa + utilities + mgmtMonthly;
  const monthlyOperating = resolveOperatingExpenses(
    parseNum(metrics.monthlyExpenses) ?? 0,
    monthlyLoanPayment,
    lineItemOperating
  );
  const vacancyPct = parseNum(answers.vacancyAllowancePct) ?? 0;
  const effectiveMonthlyIncome =
    monthlyGrossIncome > 0
      ? monthlyGrossIncome * (1 - Math.min(100, Math.max(0, vacancyPct)) / 100)
      : metricsIncome;
  const financials = computeMonthlyFinancials({
    monthlyGrossIncome,
    effectiveMonthlyIncome,
    monthlyOperatingExpenses: monthlyOperating,
    monthlyDebtService: monthlyLoanPayment,
    monthlyCashFlowOverride: parseNum(metrics.projectedCashFlow ?? metrics.monthlyCashFlow)
  });
  const monthlyCashFlow = financials.monthlyCashFlow;

  const purchasePrice = parseNum(answers.purchasePrice);
  const marketValue = parseNum(answers.marketValue) ?? purchasePrice;
  const loanAmount = parseNum(answers.loanAmount);
  const cashResolved = resolveTotalCashInvested({
    depositPayment: parseNum(answers.cashInvested),
    closingCosts: parseNum(answers.closingCosts),
    transferCosts: parseNum(answers.transferCosts),
    bondRegistrationCosts:
      parseNum(answers.bondRegistrationCosts) ?? parseNum(answers.bondCosts),
    attorneyFees: parseNum(answers.attorneyFees),
    repairsRenovation: parseNum(answers.repairsRenovation),
    otherInitialCashCosts: parseNum(answers.otherInitialCashCosts)
  });
  const totalCashInvested = cashResolved.totalCashInvested;
  const cashInvestmentRows = buildCashInvestmentRows(cashResolved);
  const annualCashFlow = financials.annualCashFlow;
  const cashOnCashRoi = computeCashOnCashRoiPercent(annualCashFlow, totalCashInvested);
  const ratePct = parseNum(answers.interestRateApr);
  const defaults = opts.projectionAssumptions ?? null;
  const incomeGrowthPct =
    defaults?.annualIncomeGrowthPercentAnnual != null ? defaults.annualIncomeGrowthPercentAnnual : 6;
  const expenseGrowthPct =
    defaults?.expenseGrowthPercentAnnual != null ? defaults.expenseGrowthPercentAnnual : 6;
  const appreciationPct =
    parseNum(answers.expectedAppreciationPct) ??
    (defaults?.propertyAppreciationPercentAnnual != null ? defaults.propertyAppreciationPercentAnnual : 6);
  const termYears = parseNum(answers.loanTermYears) ?? parseNum(answers.amortizationYears);

  const equity =
    marketValue != null && loanAmount != null ? marketValue - loanAmount : marketValue ?? null;
  const ltv = parseNum(metrics.ltv);
  const grossYield = parseNum(metrics.grossYield);
  const irrVal = parseNum(metrics.internalRateofReturn ?? metrics.internalRateOfReturn);
  const metricsIrrByYear = Array.isArray(metrics.irrByYear)
    ? (metrics.irrByYear as IrrByYearEntry[])
    : null;

  const units = metrics.unitsOccupied as { occupied?: number; total?: number } | null | undefined;
  const occupancyLabel =
    units?.total != null && units.total > 0
      ? `${Math.round(((units.occupied ?? 0) / units.total) * 100)}%`
      : parseNum(answers.occupancyPct) != null
        ? `${parseNum(answers.occupancyPct)!.toFixed(0)}%`
        : null;

  const propertyDetails = buildCalculatorPropertyInformationRows(answers, metrics, typeLabel, cashResolved);
  const monthlyIncomeExpense = buildCalculatorIncomeExpenseRows(answers, financials, monthlyGrossIncome);
  const assumptions = buildCalculatorLoanAssumptionRows(answers, metrics, {
    incomeGrowthPct,
    expenseGrowthPct,
    appreciationPct
  });

  const expenseBreakdown: { label: string; amount: number }[] = [];
  if (rates > 0) expenseBreakdown.push({ label: "Rates & taxes", amount: rates });
  if (insurance > 0) expenseBreakdown.push({ label: "Insurance", amount: insurance });
  if (maintenance > 0) expenseBreakdown.push({ label: "Maintenance", amount: maintenance });
  if (mgmtMonthly > 0) expenseBreakdown.push({ label: "Management fee", amount: mgmtMonthly });
  if (hoa > 0) expenseBreakdown.push({ label: "HOA / levies", amount: hoa });
  if (utilities > 0) expenseBreakdown.push({ label: "Utilities", amount: utilities });
  if (monthlyLoanPayment > 0) expenseBreakdown.push({ label: "Loan payment", amount: monthlyLoanPayment });

  const baseValue = marketValue ?? purchasePrice ?? 0;
  const startLoan = loanAmount ?? 0;
  const baseAnnualEffective = financials.effectiveMonthlyIncome * 12;
  const baseAnnualOperating = monthlyOperating * 12;

  const yearCols = [...PROJECTION_YEAR_COLUMNS];
  const sellingCostPct = parseNum(answers.sellingCostsPercent) ?? parseNum(answers.sellingCostPct);
  const holdYears = parseNum(answers.holdYears);
  const irrByYear =
    metricsIrrByYear ??
    calculateIRRByProjectionYear({
      initialCashInvested: totalCashInvested,
      baseAnnualIncome: baseAnnualEffective,
      baseAnnualOperatingExpenses: baseAnnualOperating,
      annualDebtService: monthlyLoanPayment * 12,
      basePropertyValue: baseValue,
      startLoanBalance: startLoan,
      incomeGrowthPct,
      expenseGrowthPct,
      propertyGrowthPct: appreciationPct,
      monthlyLoanPayment,
      interestRateApr: ratePct,
      sellingCostPct,
      projectionYears: yearCols,
      holdingPeriodYears: holdYears,
      hasLoan: startLoan > 0
    });
  const irrByHorizon = irrByYear.map((row) => row.irr);
  const defaultIrr = irrVal ?? resolveDefaultIrr(irrByYear, holdYears);
  const projection = buildAnnualProjectionRows({
    monthlyGrossIncome,
    effectiveMonthlyIncome: financials.effectiveMonthlyIncome,
    monthlyOperating,
    monthlyDebtService: monthlyLoanPayment,
    incomeGrowthPct,
    expenseGrowthPct,
    appreciationPct,
    basePropertyValue: baseValue,
    startLoan,
    monthlyLoanPayment,
    ratePct,
    totalCashInvested,
    irrByHorizon
  });

  const twoPercentRule =
    purchasePrice != null && purchasePrice > 0 && monthlyIncome > 0
      ? Number(((monthlyIncome / purchasePrice) * 100).toFixed(2))
      : null;

  const meetsFiftyBond =
    monthlyIncome > 0 && monthlyLoanPayment > 0 ? monthlyIncome * 0.5 > monthlyLoanPayment : null;

  const investmentRating = derivePdfInvestmentRating({
    monthlyGrossIncome: monthlyIncome,
    monthlyCashFlow,
    monthlyOperatingExpenses: monthlyOperating,
    monthlyLoanPayment: monthlyLoanPayment > 0 ? monthlyLoanPayment : 0,
    grossYield,
    twoPercentRule,
    cashOnCashRoi,
    internalRateOfReturn: defaultIrr,
    totalCashInvested,
    purchasePrice,
    meetsFiftyPercentBond: meetsFiftyBond
  });

  const keyAssumptions: { label: string; value: string }[] = [
    {
      label: "Total Cash Invested",
      value: totalCashInvested != null && totalCashInvested > 0 ? formatZar(totalCashInvested) : "—"
    },
    { label: "Annual rent growth", value: formatPct(incomeGrowthPct) },
    { label: "Expense growth", value: formatPct(expenseGrowthPct) },
    { label: "Property appreciation", value: formatPct(appreciationPct) }
  ];

  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });

  return {
    generatedAt: now.toISOString(),
    reportingPeriodLabel: monthLabel,
    property: {
      name: typeLabel,
      address: "",
      propertyType: typeLabel,
      investmentType: "Calculator scenario",
      imageNote: "No property image available"
    },
    propertyDetails,
    monthlyIncomeExpense,
    propertyInfo: propertyDetails,
    cashInvestment: {
      totalCashInvested,
      depositPayment: cashResolved.depositPayment > 0 ? cashResolved.depositPayment : null,
      closingCosts: cashResolved.closingCosts > 0 ? cashResolved.closingCosts : null,
      transferCosts: cashResolved.transferCosts > 0 ? cashResolved.transferCosts : null,
      bondRegistrationCosts:
        cashResolved.bondRegistrationCosts > 0 ? cashResolved.bondRegistrationCosts : null,
      repairsRenovation: cashResolved.repairsRenovation > 0 ? cashResolved.repairsRenovation : null,
      attorneyFees: cashResolved.attorneyFees > 0 ? cashResolved.attorneyFees : null
    },
    cashInvestmentRows,
    metrics: {
      monthlyIncome,
      monthlyExpenses: financials.monthlyOperatingExpenses,
      monthlyOperatingExpenses: financials.monthlyOperatingExpenses,
      monthlyDebtService: financials.monthlyDebtService,
      monthlyTotalOutflows: financials.monthlyTotalOutflows,
      effectiveMonthlyIncome: financials.effectiveMonthlyIncome,
      monthlyNoi: financials.monthlyNoi,
      monthlyCashFlow,
      totalCashNeeded: totalCashInvested,
      annualCashFlow,
      marketValue,
      purchasePrice,
      equity,
      occupancyLabel,
      grossRentalYield: grossYield,
      internalRateOfReturn: defaultIrr,
      cashOnCashRoi,
      capRate: parseNum(metrics.netYield),
      twoPercentRule,
      ltv
    },
    keyAssumptions,
    executiveSummary: buildExecutiveSummary(investmentRating),
    investmentRating,
    assumptions,
    expenseBreakdown,
    projection,
    actuals: [],
    comparison: [
      {
        metric: "Gross Rent",
        projected: formatZar(monthlyIncome),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Effective Income",
        projected: formatZar(financials.effectiveMonthlyIncome),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Operating Expenses",
        projected: formatZar(financials.monthlyOperatingExpenses),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Net Operating Income",
        projected: formatZar(financials.monthlyNoi),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Debt Service",
        projected: formatZar(financials.monthlyDebtService),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Cash Flow After Debt Service",
        projected: formatZar(monthlyCashFlow),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Occupancy",
        projected: occupancyLabel ?? "—",
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      }
    ],
    leases: [],
    fiftyPercentRule: buildFiftyPercentBondRuleRows(monthlyIncome, monthlyLoanPayment)
  };
}
