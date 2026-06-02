import { round2 } from "./financialMetrics";
import { projectLoanBalanceAfterYears } from "./loanProjection";
import { projectValue } from "./projectionCalculator";

export type IrrByYearEntry = {
  year: number;
  irr: number | null;
  exitValue: number | null;
  cashFlows: number[];
};

export type IrrProjectionInputs = {
  initialCashInvested: number | null;
  baseAnnualIncome: number;
  baseAnnualOperatingExpenses: number;
  annualDebtService: number;
  basePropertyValue: number;
  startLoanBalance: number;
  incomeGrowthPct: number;
  expenseGrowthPct: number;
  propertyGrowthPct: number;
  monthlyLoanPayment: number;
  interestRateApr: number | null;
  sellingCostPct: number | null;
  projectionYears: number[];
  holdingPeriodYears?: number | null;
  hasLoan: boolean;
};

/** Net present value at annual discount rate `rate` (decimal, e.g. 0.1). */
export function npv(rate: number, cashFlows: number[]): number {
  if (!Number.isFinite(rate) || rate <= -1) return NaN;
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const cf = cashFlows[t] ?? 0;
    if (!Number.isFinite(cf)) return NaN;
    total += cf / Math.pow(1 + rate, t);
  }
  return total;
}

function npvDerivative(rate: number, cashFlows: number[]): number {
  let total = 0;
  const denomBase = 1 + rate;
  for (let t = 1; t < cashFlows.length; t++) {
    const cf = cashFlows[t] ?? 0;
    if (!Number.isFinite(cf)) return NaN;
    total += (-t * cf) / Math.pow(denomBase, t + 1);
  }
  return total;
}

function hasSignChange(cashFlows: number[]): boolean {
  return cashFlows.some((c) => c > 0) && cashFlows.some((c) => c < 0);
}

function irrBisection(cashFlows: number[]): number | null {
  const low = -0.9999;
  const high = 10;
  const tol = 1e-7;
  const maxIter = 200;

  let flo = npv(low, cashFlows);
  let fhi = npv(high, cashFlows);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;
  if (flo === 0) return low;
  if (fhi === 0) return high;
  if (flo * fhi > 0) return null;

  let a = low;
  let b = high;
  let fa = flo;
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = npv(m, cashFlows);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < tol || Math.abs(b - a) < tol) return m;
    if (fa * fm < 0) {
      b = m;
    } else {
      a = m;
      fa = fm;
    }
  }
  const mid = (a + b) / 2;
  return Number.isFinite(mid) ? mid : null;
}

/**
 * Annual IRR as a percentage (e.g. 18.42), or null if unsolvable.
 * `cashFlows[0]` is normally negative (initial investment).
 */
export function calculateIRR(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  if (!hasSignChange(cashFlows)) return null;

  let rate = 0.1;
  const minR = -0.9999;
  const maxR = 10;
  const tol = 1e-7;

  for (let i = 0; i < 100; i++) {
    const f = npv(rate, cashFlows);
    const d = npvDerivative(rate, cashFlows);
    if (!Number.isFinite(f) || !Number.isFinite(d) || Math.abs(d) < 1e-12) break;
    const next = rate - f / d;
    if (!Number.isFinite(next)) break;
    rate = Math.min(maxR, Math.max(minR, next));
    if (Math.abs(f) < tol) {
      const pct = round2(rate * 100);
      return Number.isFinite(pct) ? pct : null;
    }
  }

  const solved = irrBisection(cashFlows);
  if (solved == null || !Number.isFinite(solved)) return null;
  const pct = round2(solved * 100);
  if (!Number.isFinite(pct)) return null;
  return pct;
}

export function computeTerminalExitValue(opts: {
  projectedPropertyValue: number | null;
  projectedLoanBalance: number | null;
  sellingCostPct: number | null;
  hasLoan: boolean;
}): number | null {
  const { projectedPropertyValue, projectedLoanBalance, sellingCostPct, hasLoan } = opts;
  if (projectedPropertyValue == null || !(projectedPropertyValue > 0)) return null;

  if (hasLoan) {
    if (projectedLoanBalance == null) return null;
  }

  const loan = projectedLoanBalance ?? 0;
  const sellPct = sellingCostPct != null && sellingCostPct > 0 ? sellingCostPct : 0;
  const sellingCosts = projectedPropertyValue * (sellPct / 100);
  return round2(projectedPropertyValue - loan - sellingCosts);
}

function buildCashFlowsToYear(input: IrrProjectionInputs, horizonYears: number): {
  cashFlows: number[];
  exitValue: number | null;
} | null {
  const invested = input.initialCashInvested;
  if (invested == null || !(invested > 0)) return null;

  const flows: number[] = [-invested];

  const projectAnnualAmount = (base: number, annualPct: number | null, years: number): number | null => {
    if (!Number.isFinite(base) || base < 0) return null;
    if (base === 0) return 0;
    return projectValue(base, annualPct, years);
  };

  for (let t = 1; t <= horizonYears; t++) {
    const inc = projectAnnualAmount(input.baseAnnualIncome, input.incomeGrowthPct, t);
    const exp = projectAnnualAmount(input.baseAnnualOperatingExpenses, input.expenseGrowthPct, t);
    if (inc == null || exp == null) return null;
    const annualCf = round2(inc - exp - input.annualDebtService);
    flows.push(annualCf);
  }

  const propertyValueAtExit = projectValue(input.basePropertyValue, input.propertyGrowthPct, horizonYears);
  const loanAtExit =
    input.startLoanBalance > 0
      ? projectLoanBalanceAfterYears(
          input.startLoanBalance,
          input.monthlyLoanPayment,
          input.interestRateApr,
          horizonYears
        )
      : 0;

  if (propertyValueAtExit == null) return null;

  const exitValue = computeTerminalExitValue({
    projectedPropertyValue: propertyValueAtExit,
    projectedLoanBalance: loanAtExit,
    sellingCostPct: input.sellingCostPct,
    hasLoan: input.hasLoan
  });

  if (exitValue == null) return null;

  const lastIdx = flows.length - 1;
  flows[lastIdx] = round2((flows[lastIdx] ?? 0) + exitValue);

  return { cashFlows: flows, exitValue };
}

export function calculateIRRByProjectionYear(input: IrrProjectionInputs): IrrByYearEntry[] {
  return input.projectionYears.map((year) => {
    if (year < 1) {
      return { year, irr: null, exitValue: null, cashFlows: [] };
    }
    const built = buildCashFlowsToYear(input, year);
    if (!built) {
      return { year, irr: null, exitValue: null, cashFlows: [] };
    }
    return {
      year,
      irr: calculateIRR(built.cashFlows),
      exitValue: built.exitValue,
      cashFlows: built.cashFlows
    };
  });
}

export function resolveDefaultIrr(
  irrByYear: IrrByYearEntry[],
  holdingPeriodYears: number | null | undefined
): number | null {
  if (!irrByYear.length) return null;

  const pick = (year: number): number | null => {
    const entry = irrByYear.find((row) => row.year === year);
    return entry?.irr ?? null;
  };

  if (holdingPeriodYears != null && holdingPeriodYears > 0) {
    const exact = pick(holdingPeriodYears);
    if (exact != null) return exact;
    const years = irrByYear.map((r) => r.year);
    const closest = years.reduce((best, y) =>
      Math.abs(y - holdingPeriodYears) < Math.abs(best - holdingPeriodYears) ? y : best
    );
    const closestIrr = pick(closest);
    if (closestIrr != null) return closestIrr;
  }

  const year10 = pick(10);
  if (year10 != null) return year10;

  for (const row of irrByYear) {
    if (row.irr != null) return row.irr;
  }
  return null;
}

/** @deprecated Use {@link calculateIRR} — kept for API report tests. */
export function irrPercent(c0: number | null, cashFlows: number[]): number | null {
  if (c0 == null || !(c0 > 0)) return null;
  return calculateIRR([-c0, ...cashFlows]);
}
