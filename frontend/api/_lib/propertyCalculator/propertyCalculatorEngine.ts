import type { NormalizedPropertyCalculatorInput, PropertyCalculatorResult } from "./calculatorTypes";
import { calculateIRRByProjectionYear, resolveDefaultIrr } from "./irrCalculator";
import {
  computeCapRatePercent,
  computeCashOnCashRoiPercent,
  computeEquity,
  computeFiftyPercentRuleCashFlow,
  computeGrossYieldPercent,
  computeLtvPercent,
  computeNetYieldPercent,
  computeTwoPercentRulePercent,
  deriveInvestmentRating,
  meetsFiftyPercentRule,
  resolveTotalCashInvested,
  round2,
  sumNullable,
  totalProjectCost
} from "./financialMetrics";
import { computeIncomeByPropertyType, isVacantLandType } from "./incomeByPropertyType";
import { buildAnnualProjectionSeries, DEFAULT_PROJECTION_YEARS } from "./projectionCalculator";

function resolveMonthlyLoanPayment(input: NormalizedPropertyCalculatorInput): number | null {
  if (input.monthlyLoanPayment != null && input.monthlyLoanPayment >= 0) {
    return round2(input.monthlyLoanPayment);
  }
  return null;
}

function resolveOperatingExpenses(
  input: NormalizedPropertyCalculatorInput,
  effectiveMonthlyIncome: number | null,
  typeSpecificOperatingExpense: number
): number | null {
  if (input.monthlyOperatingExpensesOverride != null) {
    return round2(input.monthlyOperatingExpensesOverride);
  }

  const fixed = sumNullable(
    input.ratesTaxesMonthly,
    input.insuranceMonthly,
    input.maintenanceMonthly,
    input.utilitiesMonthly,
    input.leviesMonthly,
    input.otherExpensesMonthly,
    input.cleaningCosts,
    input.holdingCostsMonthly
  );

  const managementFee =
    effectiveMonthlyIncome != null && input.managementFeePct != null
      ? (effectiveMonthlyIncome * input.managementFeePct) / 100
      : 0;

  if (isVacantLandType(input.propertyType)) {
    const landExpenses = fixed > 0 ? round2(fixed) : null;
    return landExpenses;
  }

  if (effectiveMonthlyIncome == null && fixed <= 0 && typeSpecificOperatingExpense <= 0) {
    return null;
  }

  return round2(fixed + typeSpecificOperatingExpense + managementFee);
}

export function runPropertyCalculator(input: NormalizedPropertyCalculatorInput): PropertyCalculatorResult {
  const warnings: string[] = [];
  const missingInputs: string[] = [];

  const income = computeIncomeByPropertyType(input);
  missingInputs.push(...income.missingInputs);

  const monthlyLoanPayment = resolveMonthlyLoanPayment(input);
  const monthlyOperating = resolveOperatingExpenses(input, income.effectiveMonthlyIncome, income.typeSpecificOperatingExpense);
  const monthlyDebtService =
    input.monthlyDebtServiceOverride != null
      ? round2(input.monthlyDebtServiceOverride)
      : monthlyLoanPayment != null
        ? round2(monthlyLoanPayment)
        : 0;

  const monthlyExpenses =
    monthlyOperating == null && monthlyDebtService <= 0
      ? null
      : round2((monthlyOperating ?? 0) + monthlyDebtService);

  const effectiveMonthlyIncome = income.effectiveMonthlyIncome;
  const monthlyCashFlow =
    isVacantLandType(input.propertyType) && effectiveMonthlyIncome == null
      ? monthlyExpenses != null
        ? round2(-monthlyExpenses)
        : null
      : effectiveMonthlyIncome == null
        ? null
        : round2(effectiveMonthlyIncome - (monthlyExpenses ?? 0));

  const annualIncome = effectiveMonthlyIncome != null ? round2(effectiveMonthlyIncome * 12) : null;
  const annualOperating = monthlyOperating != null ? round2(monthlyOperating * 12) : null;
  const annualExpenses = monthlyExpenses != null ? round2(monthlyExpenses * 12) : null;
  const annualCashFlow = monthlyCashFlow != null ? round2(monthlyCashFlow * 12) : null;

  const purchasePrice = input.purchasePrice;
  const marketValue = input.marketValue;
  const loanBalance = input.loanBalance ?? input.loanAmount;
  const totalCashIn = resolveTotalCashInvested({
    depositPayment: input.cashInvested,
    closingCosts: input.closingCosts,
    repairsRenovation: input.repairsRenovation
  }).totalCashInvested;

  const grossYield = computeGrossYieldPercent(annualIncome, purchasePrice);
  const netYield = computeNetYieldPercent(effectiveMonthlyIncome, monthlyOperating, purchasePrice);
  const cashOnCashRoi = computeCashOnCashRoiPercent(annualCashFlow, totalCashIn);
  const equity = computeEquity(marketValue, loanBalance);
  const ltv = computeLtvPercent(input.loanAmount, marketValue, purchasePrice);
  const capRate = computeCapRatePercent(effectiveMonthlyIncome, monthlyOperating, marketValue, purchasePrice);
  const twoPercentRule = computeTwoPercentRulePercent(income.grossMonthlyIncome, purchasePrice);
  const fiftyPercentRule = computeFiftyPercentRuleCashFlow(effectiveMonthlyIncome, monthlyLoanPayment);
  const meetsFifty = meetsFiftyPercentRule(effectiveMonthlyIncome, monthlyOperating);

  const baseValue = marketValue != null && marketValue > 0 ? marketValue : purchasePrice ?? 0;
  const holdYears = input.holdingPeriodYears;

  const incomeGrowth = input.annualRentGrowthPct ?? 6;
  const expenseGrowth = input.annualExpenseGrowthPct ?? 6;
  const propertyGrowth = input.annualPropertyGrowthPct ?? 6;
  const projectionYears = [...DEFAULT_PROJECTION_YEARS];
  const annualDebtService = (monthlyLoanPayment ?? 0) * 12;
  const startLoan = loanBalance ?? 0;
  const hasLoan = startLoan > 0 || (input.loanAmount != null && input.loanAmount > 0);

  const projection = buildAnnualProjectionSeries({
    years: projectionYears,
    baseAnnualIncome: annualIncome ?? 0,
    baseAnnualOperatingExpenses: annualOperating ?? 0,
    annualDebtService,
    basePropertyValue: baseValue,
    startLoanBalance: startLoan,
    incomeGrowthPct: incomeGrowth,
    expenseGrowthPct: expenseGrowth,
    propertyGrowthPct: propertyGrowth,
    monthlyLoanPayment: monthlyLoanPayment ?? 0,
    interestRateApr: input.interestRateApr
  });

  const irrByYear = calculateIRRByProjectionYear({
    initialCashInvested: totalCashIn,
    baseAnnualIncome: annualIncome ?? 0,
    baseAnnualOperatingExpenses: annualOperating ?? 0,
    annualDebtService,
    basePropertyValue: baseValue,
    startLoanBalance: startLoan,
    incomeGrowthPct: incomeGrowth,
    expenseGrowthPct: expenseGrowth,
    propertyGrowthPct: propertyGrowth,
    monthlyLoanPayment: monthlyLoanPayment ?? 0,
    interestRateApr: input.interestRateApr,
    sellingCostPct: input.sellingCostPct,
    projectionYears,
    holdingPeriodYears: holdYears,
    hasLoan
  });
  const irr = resolveDefaultIrr(irrByYear, holdYears);

  if (totalCashIn == null || totalCashIn <= 0) {
    warnings.push(
      "Total upfront cash invested is missing — cash-on-cash ROI requires deposit, transfer/bond costs, closing costs or other upfront cash."
    );
  }
  if (irr == null) {
    warnings.push("IRR requires cash invested and projected exit value.");
  }
  if (purchasePrice == null || purchasePrice <= 0) {
    warnings.push("Purchase price is missing — yield metrics may be unavailable.");
  }

  const investmentRating = deriveInvestmentRating({
    monthlyCashFlow,
    cashOnCashRoi,
    meetsFiftyPercent: meetsFifty
  });

  return {
    monthlyIncome: income.grossMonthlyIncome != null ? round2(income.grossMonthlyIncome) : null,
    effectiveMonthlyIncome,
    monthlyExpenses,
    monthlyLoanPayment,
    monthlyCashFlow,
    annualIncome,
    annualExpenses,
    annualCashFlow,
    grossYield,
    netYield,
    cashOnCashRoi,
    equity,
    ltv,
    capRate,
    irr,
    irrByYear,
    occupancyRate: income.occupancyRate,
    unitsOccupied: income.unitsOccupied,
    totalUnits: income.totalUnits,
    totalProjectCost: totalProjectCost({
      purchasePrice,
      closingCosts: input.closingCosts,
      repairsRenovation: input.repairsRenovation
    }),
    projectedYears: projectionYears,
    projectedIncome: projection.projectedIncome,
    projectedExpenses: projection.projectedExpenses,
    projectedCashFlow: projection.projectedCashFlow,
    projectedPropertyValue: projection.projectedPropertyValue,
    projectedLoanBalance: projection.projectedLoanBalance,
    projectedEquity: projection.projectedEquity,
    fiftyPercentRule,
    twoPercentRule,
    investmentRating,
    warnings,
    missingInputs
  };
}
