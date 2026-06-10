// api/_lib/propertyCalculator/financialMetrics.ts
function round2(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
function safeDiv(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  if (!Number.isFinite(result)) return null;
  return result;
}
function pct(numerator, denominator) {
  const ratio = safeDiv(numerator, denominator);
  return ratio == null ? null : round2(ratio * 100);
}
function computeEquity(marketValue, loanBalance) {
  if (marketValue == null || loanBalance == null) {
    if (marketValue != null && (loanBalance == null || loanBalance === 0)) return round2(marketValue);
    return null;
  }
  return round2(marketValue - loanBalance);
}
function computeLtvPercent(loanAmount, marketValue, purchasePrice) {
  const loan = loanAmount ?? null;
  const base = marketValue != null && marketValue > 0 ? marketValue : purchasePrice;
  if (loan == null || loan <= 0 || base == null || base <= 0) return null;
  return pct(loan, base);
}
function computeGrossYieldPercent(annualIncome, purchasePrice) {
  if (annualIncome == null || annualIncome <= 0 || purchasePrice == null || purchasePrice <= 0) return null;
  return pct(annualIncome, purchasePrice);
}
function computeNetYieldPercent(monthlyIncome, monthlyOperatingExpenses, purchasePrice) {
  if (monthlyIncome == null || monthlyOperatingExpenses == null || purchasePrice == null || purchasePrice <= 0) {
    return null;
  }
  const annualNoi = (monthlyIncome - monthlyOperatingExpenses) * 12;
  return pct(annualNoi, purchasePrice);
}
function computeCashOnCashRoiPercent(annualCashFlow, cashInvested) {
  if (annualCashFlow == null || cashInvested == null || cashInvested <= 0) return null;
  return pct(annualCashFlow, cashInvested);
}
function computeCapRatePercent(monthlyIncome, monthlyOperatingExpenses, marketValue, purchasePrice) {
  if (monthlyIncome == null || monthlyOperatingExpenses == null) return null;
  const value = marketValue != null && marketValue > 0 ? marketValue : purchasePrice;
  if (value == null || value <= 0) return null;
  const annualNoi = (monthlyIncome - monthlyOperatingExpenses) * 12;
  if (annualNoi <= 0) return null;
  return pct(annualNoi, value);
}
function computeTwoPercentRulePercent(monthlyRent, purchasePrice) {
  if (monthlyRent == null || monthlyRent <= 0 || purchasePrice == null || purchasePrice <= 0) return null;
  return pct(monthlyRent, purchasePrice);
}
function computeFiftyPercentRuleCashFlow(monthlyIncome, monthlyLoanPayment) {
  if (monthlyIncome == null) return null;
  const half = monthlyIncome * 0.5;
  const debt = monthlyLoanPayment ?? 0;
  return round2(monthlyIncome - half - debt);
}
function computeMetricsFromMonthlySnapshot(opts) {
  const monthlyExpenses = opts.monthlyOperatingExpenses + opts.monthlyLoanPayment;
  const monthlyCashFlow = round2(opts.monthlyIncome - monthlyExpenses);
  const annualCashFlow = round2(monthlyCashFlow * 12);
  const annualIncome = round2(opts.monthlyIncome * 12);
  const valueForYield = opts.marketValue ?? opts.purchasePrice;
  return {
    monthlyCashFlow,
    annualCashFlow,
    grossYield: valueForYield != null && valueForYield > 0 && opts.monthlyIncome > 0 ? pct(annualIncome, valueForYield) : computeGrossYieldPercent(annualIncome, opts.purchasePrice),
    netYield: computeNetYieldPercent(opts.monthlyIncome, opts.monthlyOperatingExpenses, opts.purchasePrice),
    cashOnCashRoi: computeCashOnCashRoiPercent(annualCashFlow, opts.cashInvested),
    equity: computeEquity(opts.marketValue, opts.loanBalance),
    ltv: computeLtvPercent(opts.loanAmount ?? opts.loanBalance, opts.marketValue, opts.purchasePrice),
    capRate: computeCapRatePercent(opts.monthlyIncome, opts.monthlyOperatingExpenses, opts.marketValue, opts.purchasePrice),
    twoPercentRule: computeTwoPercentRulePercent(opts.monthlyIncome, opts.purchasePrice),
    fiftyPercentRule: computeFiftyPercentRuleCashFlow(opts.monthlyIncome, opts.monthlyLoanPayment)
  };
}

// api/_lib/propertyCalculator/loanProjection.ts
function projectLoanBalanceAfterYears(startBalance, monthlyPayment, annualRatePct, years) {
  if (startBalance <= 0) return 0;
  const months = years * 12;
  if (months <= 0) return startBalance;
  const rate = annualRatePct != null && annualRatePct > 0 ? annualRatePct : null;
  let balance = startBalance;
  const pmt = monthlyPayment > 0 ? monthlyPayment : null;
  if (pmt == null && rate == null) return null;
  for (let i = 0; i < months; i++) {
    const interest = rate != null ? balance * rate / 100 / 12 : 0;
    const pay = pmt ?? interest;
    const principal = Math.max(0, pay - interest);
    balance = Math.max(0, balance - principal);
    if (balance <= 5e-3) return 0;
  }
  return Math.round(balance * 100) / 100;
}

// api/_lib/propertyCalculator/projectionCalculator.ts
function projectValue(base, annualPct, years) {
  if (!(base > 0) || years < 0) return null;
  if (annualPct == null || !Number.isFinite(annualPct)) return round2(base);
  const result = base * Math.pow(1 + annualPct / 100, years);
  return Number.isFinite(result) ? round2(result) : null;
}

// api/_lib/propertyCalculator/irrCalculator.ts
function npv(rate, cashFlows) {
  if (!Number.isFinite(rate) || rate <= -1) return NaN;
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const cf = cashFlows[t] ?? 0;
    if (!Number.isFinite(cf)) return NaN;
    total += cf / Math.pow(1 + rate, t);
  }
  return total;
}
function npvDerivative(rate, cashFlows) {
  let total = 0;
  const denomBase = 1 + rate;
  for (let t = 1; t < cashFlows.length; t++) {
    const cf = cashFlows[t] ?? 0;
    if (!Number.isFinite(cf)) return NaN;
    total += -t * cf / Math.pow(denomBase, t + 1);
  }
  return total;
}
function hasSignChange(cashFlows) {
  return cashFlows.some((c) => c > 0) && cashFlows.some((c) => c < 0);
}
function irrBisection(cashFlows) {
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
function calculateIRR(cashFlows) {
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
      const pct3 = round2(rate * 100);
      return Number.isFinite(pct3) ? pct3 : null;
    }
  }
  const solved = irrBisection(cashFlows);
  if (solved == null || !Number.isFinite(solved)) return null;
  const pct2 = round2(solved * 100);
  if (!Number.isFinite(pct2)) return null;
  return pct2;
}
function computeTerminalExitValue(opts) {
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
function buildCashFlowsToYear(input, horizonYears) {
  const invested = input.initialCashInvested;
  if (invested == null || !(invested > 0)) return null;
  const flows = [-invested];
  const projectAnnualAmount = (base, annualPct, years) => {
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
  const loanAtExit = input.startLoanBalance > 0 ? projectLoanBalanceAfterYears(
    input.startLoanBalance,
    input.monthlyLoanPayment,
    input.interestRateApr,
    horizonYears
  ) : 0;
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
function calculateIRRByProjectionYear(input) {
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
function resolveDefaultIrr(irrByYear, holdingPeriodYears) {
  if (!irrByYear.length) return null;
  const pick = (year) => {
    const entry = irrByYear.find((row) => row.year === year);
    return entry?.irr ?? null;
  };
  if (holdingPeriodYears != null && holdingPeriodYears > 0) {
    const exact = pick(holdingPeriodYears);
    if (exact != null) return exact;
    const years = irrByYear.map((r) => r.year);
    const closest = years.reduce(
      (best, y) => Math.abs(y - holdingPeriodYears) < Math.abs(best - holdingPeriodYears) ? y : best
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
function irrPercent(c0, cashFlows) {
  if (c0 == null || !(c0 > 0)) return null;
  return calculateIRR([-c0, ...cashFlows]);
}
export {
  calculateIRR,
  calculateIRRByProjectionYear,
  computeMetricsFromMonthlySnapshot,
  irrPercent,
  projectLoanBalanceAfterYears,
  projectValue,
  resolveDefaultIrr
};
