import type { Money, Percent } from "./calculatorTypes.js";
import { solveIrrPeriodicCashFlows } from "./irrSolver.js";

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: Money) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(safe);
}

export function formatPercent(pct: Percent) {
  const safe = Number.isFinite(pct) ? pct : 0;
  return `${round2(safe).toFixed(2)}%`;
}

export function assertNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
}

export function assertPositive(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateMonthlyBondPayment(params: {
  principal: Money;
  annualInterestRatePercent: Percent;
  termYears: number;
}) {
  const P = params.principal;
  const r = params.annualInterestRatePercent / 100 / 12;
  const n = params.termYears * 12;
  if (n <= 0) throw new Error("Loan term must be at least 1 year");
  if (P <= 0) return { monthlyPayment: 0, monthlyRate: r, numberPayments: n };
  const monthlyPayment =
    r === 0 ? P / n : (P * (r * (1 + r) ** n)) / ((1 + r) ** n - 1);
  return { monthlyPayment, monthlyRate: r, numberPayments: n };
}

export function calculateAnnualDebtService(monthlyBondPayment: Money) {
  assertNonNegative("Monthly bond payment", monthlyBondPayment);
  return monthlyBondPayment * 12;
}

import { calculateTransferDutySA } from "./saTransferBondCosts.js";

/** @deprecated Use `calculateTransferDutySA` with explicit transaction type; kept for other calculators that only pass price. */
export function calculateTransferDutySouthAfrica(purchasePrice: Money) {
  assertNonNegative("Purchase price", purchasePrice);
  return calculateTransferDutySA(purchasePrice, "TRANSFER_DUTY");
}

export function calculateNOI(params: {
  grossMonthlyRent: Money;
  otherMonthlyIncome: Money;
  vacancyRatePercent: Percent;
  monthlyOperatingExpenses: Money;
}) {
  assertNonNegative("Gross monthly rent", params.grossMonthlyRent);
  assertNonNegative("Other monthly income", params.otherMonthlyIncome);
  const vacancyRate = clamp(params.vacancyRatePercent, 0, 100);
  assertNonNegative("Monthly operating expenses", params.monthlyOperatingExpenses);

  const grossPotentialIncomeMonthly = params.grossMonthlyRent + params.otherMonthlyIncome;
  const vacancyLossMonthly = grossPotentialIncomeMonthly * (vacancyRate / 100);
  const effectiveGrossIncomeMonthly = grossPotentialIncomeMonthly - vacancyLossMonthly;
  const noiMonthly = effectiveGrossIncomeMonthly - params.monthlyOperatingExpenses;

  return {
    grossPotentialIncomeMonthly,
    grossPotentialIncomeAnnual: grossPotentialIncomeMonthly * 12,
    vacancyRatePercent: vacancyRate,
    vacancyLossMonthly,
    vacancyLossAnnual: vacancyLossMonthly * 12,
    effectiveGrossIncomeMonthly,
    effectiveGrossIncomeAnnual: effectiveGrossIncomeMonthly * 12,
    operatingExpensesMonthly: params.monthlyOperatingExpenses,
    operatingExpensesAnnual: params.monthlyOperatingExpenses * 12,
    noiMonthly,
    noiAnnual: noiMonthly * 12
  };
}

export function calculateCashFlow(params: {
  grossMonthlyIncome: Money;
  vacancyLossMonthly: Money;
  monthlyOperatingExpenses: Money;
  monthlyDebtService: Money;
}) {
  assertNonNegative("Gross monthly income", params.grossMonthlyIncome);
  assertNonNegative("Vacancy loss monthly", params.vacancyLossMonthly);
  assertNonNegative("Monthly operating expenses", params.monthlyOperatingExpenses);
  assertNonNegative("Monthly debt service", params.monthlyDebtService);

  const effectiveMonthlyIncome = params.grossMonthlyIncome - params.vacancyLossMonthly;
  const monthlyNOI = effectiveMonthlyIncome - params.monthlyOperatingExpenses;
  const monthlyCashFlow = monthlyNOI - params.monthlyDebtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashFlowMarginPercent = params.grossMonthlyIncome > 0 ? (monthlyCashFlow / params.grossMonthlyIncome) * 100 : 0;

  return {
    effectiveMonthlyIncome,
    monthlyNOI,
    monthlyCashFlow,
    annualCashFlow,
    cashFlowMarginPercent
  };
}

export function calculateNPV(params: { discountRatePercent: Percent; cashFlows: Money[] }) {
  const r = params.discountRatePercent / 100;
  if (!Number.isFinite(r) || r < -0.99) throw new Error("Discount rate is invalid");
  return params.cashFlows.reduce((sum, cf, i) => sum + cf / (1 + r) ** i, 0);
}

export function calculateIRR(params: { cashFlows: Money[] }) {
  const irr = solveIrrPeriodicCashFlows(params.cashFlows);
  return { irr: irr ?? null, iterations: 0, converged: irr !== null };
}

export function calculateAmortisationSchedule(params: {
  principal: Money;
  annualInterestRatePercent: Percent;
  termYears: number;
  extraMonthlyPayment?: Money;
  onceOffExtraPayment?: Money;
}) {
  const P0 = params.principal;
  assertNonNegative("Principal", P0);
  const extraMonthly = params.extraMonthlyPayment ?? 0;
  const onceOff = params.onceOffExtraPayment ?? 0;
  assertNonNegative("Extra monthly payment", extraMonthly);
  assertNonNegative("Once-off extra payment", onceOff);

  const { monthlyPayment, monthlyRate, numberPayments } = calculateMonthlyBondPayment({
    principal: P0,
    annualInterestRatePercent: params.annualInterestRatePercent,
    termYears: params.termYears
  });

  let balance = P0;
  const schedule: Array<{
    month: number;
    payment: Money;
    interest: Money;
    principal: Money;
    balance: Money;
    extra: Money;
  }> = [];

  for (let m = 1; m <= numberPayments && balance > 0; m += 1) {
    const interest = balance * monthlyRate;
    const basePayment = monthlyPayment;
    const extra = (m === 1 ? onceOff : 0) + extraMonthly;
    const payment = Math.min(balance + interest, basePayment + extra);
    const principal = Math.max(0, payment - interest);
    balance = Math.max(0, balance - principal);
    schedule.push({ month: m, payment, interest, principal, balance, extra });
    if (m > 2000) break; // safety
  }

  const totalPaid = schedule.reduce((s, x) => s + x.payment, 0);
  const totalInterest = schedule.reduce((s, x) => s + x.interest, 0);
  const monthsToPayoff = schedule.length;

  // yearly aggregates for charts
  const yearly = new Map<number, { year: number; interest: Money; principal: Money; balanceEnd: Money }>();
  schedule.forEach((row) => {
    const year = Math.ceil(row.month / 12);
    const y = yearly.get(year) ?? { year, interest: 0, principal: 0, balanceEnd: row.balance };
    y.interest += row.interest;
    y.principal += row.principal;
    y.balanceEnd = row.balance;
    yearly.set(year, y);
  });

  return {
    monthlyPayment,
    monthlyRate,
    numberPayments,
    schedule,
    yearly: Array.from(yearly.values()).sort((a, b) => a.year - b.year),
    totalPaid,
    totalInterest,
    monthsToPayoff
  };
}

export function calculateFutureValue(params: { presentValue: Money; annualRatePercent: Percent; years: number }) {
  const r = params.annualRatePercent / 100;
  return params.presentValue * (1 + r) ** params.years;
}

export function calculateLoanConstant(params: { loanAmount: Money; annualDebtService?: Money; monthlyBondPayment?: Money }) {
  assertNonNegative("Loan amount", params.loanAmount);
  const annualDebtService =
    params.annualDebtService ?? calculateAnnualDebtService(params.monthlyBondPayment ?? 0);
  assertNonNegative("Annual debt service", annualDebtService);
  if (params.loanAmount <= 0) return { loanConstantPercent: 0, annualDebtService };
  return {
    loanConstantPercent: (annualDebtService / params.loanAmount) * 100,
    annualDebtService
  };
}

export function calculateGrossYield(params: { annualGrossRent: Money; price: Money }) {
  assertNonNegative("Annual gross rent", params.annualGrossRent);
  assertPositive("Price", params.price);
  return (params.annualGrossRent / params.price) * 100;
}

export function calculateYieldOnCost(params: { stabilisedNOI: Money; totalProjectCost: Money }) {
  assertNonNegative("Stabilised NOI", params.stabilisedNOI);
  assertPositive("Total project cost", params.totalProjectCost);
  return (params.stabilisedNOI / params.totalProjectCost) * 100;
}

export function calculateDebtYield(params: { annualNOI: Money; loanAmount: Money }) {
  assertNonNegative("Annual NOI", params.annualNOI);
  assertPositive("Loan amount", params.loanAmount);
  return (params.annualNOI / params.loanAmount) * 100;
}

export function calculateBreakEvenOccupancy(params: {
  grossPotentialIncome: Money;
  annualOperatingExpenses: Money;
  annualDebtService: Money;
}) {
  assertNonNegative("Gross potential income", params.grossPotentialIncome);
  assertNonNegative("Operating expenses", params.annualOperatingExpenses);
  assertNonNegative("Debt service", params.annualDebtService);
  if (params.grossPotentialIncome <= 0) return 0;
  return ((params.annualOperatingExpenses + params.annualDebtService) / params.grossPotentialIncome) * 100;
}

export function calculateEquityGrowth(params: {
  propertyValue: Money;
  annualAppreciationPercent: Percent;
  loanBalance: Money;
  years: number;
}) {
  const futureValue = calculateFutureValue({
    presentValue: params.propertyValue,
    annualRatePercent: params.annualAppreciationPercent,
    years: params.years
  });
  const equity = futureValue - params.loanBalance;
  return { futurePropertyValue: futureValue, futureEquity: equity };
}

/** Amortising balance after `years` full years of monthly payments. */
export function projectLoanBalanceAfterYears(
  startBalance: number,
  monthlyPayment: number,
  annualRatePct: number | null,
  years: number
): number | null {
  if (startBalance <= 0) return 0;
  const months = years * 12;
  if (months <= 0) return startBalance;
  const rate = annualRatePct != null && annualRatePct > 0 ? annualRatePct : null;
  let balance = startBalance;
  const pmt = monthlyPayment > 0 ? monthlyPayment : null;
  if (pmt == null && rate == null) return null;

  for (let i = 0; i < months; i++) {
    const interest = rate != null ? (balance * rate) / 100 / 12 : 0;
    const pay = pmt ?? interest;
    const principal = Math.max(0, pay - interest);
    balance = Math.max(0, balance - principal);
    if (balance <= 0.005) return 0;
  }
  return round2(balance);
}

