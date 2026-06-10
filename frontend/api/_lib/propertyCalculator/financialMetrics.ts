/** Pure financial metric helpers — safe division, no NaN/Infinity. */

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  if (!Number.isFinite(result)) return null;
  return result;
}

export function pct(numerator: number, denominator: number): number | null {
  const ratio = safeDiv(numerator, denominator);
  return ratio == null ? null : round2(ratio * 100);
}

export function clampPct(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export function sumNullable(...values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => {
    if (value != null && Number.isFinite(value)) return total + value;
    return total;
  }, 0);
}

export function totalProjectCost(input: {
  purchasePrice: number | null;
  closingCosts: number | null;
  repairsRenovation: number | null;
}): number | null {
  const total = sumNullable(input.purchasePrice, input.closingCosts, input.repairsRenovation);
  return total > 0 ? round2(total) : null;
}

function positiveAmount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export type TotalCashInvestedInput = {
  explicitTotalCashInvested?: number | null;
  depositPayment?: number | null;
  cashInvested?: number | null;
  closingCosts?: number | null;
  transferCosts?: number | null;
  bondRegistrationCosts?: number | null;
  bondCosts?: number | null;
  attorneyFees?: number | null;
  repairsRenovation?: number | null;
  otherInitialCashCosts?: number | null;
};

export type ResolvedTotalCashInvested = {
  totalCashInvested: number | null;
  depositPayment: number;
  closingCosts: number;
  transferCosts: number;
  bondRegistrationCosts: number;
  attorneyFees: number;
  repairsRenovation: number;
  otherInitialCashCosts: number;
};

export function resolveTotalCashInvested(input: TotalCashInvestedInput): ResolvedTotalCashInvested {
  const depositPayment = positiveAmount(input.depositPayment ?? input.cashInvested);
  const closingCosts = positiveAmount(input.closingCosts);
  const transferCosts = positiveAmount(input.transferCosts);
  const bondRegistrationCosts = positiveAmount(input.bondRegistrationCosts ?? input.bondCosts);
  const attorneyFees = positiveAmount(input.attorneyFees);
  const repairsRenovation = positiveAmount(input.repairsRenovation);
  const otherInitialCashCosts = positiveAmount(input.otherInitialCashCosts);

  const componentSum = round2(
    depositPayment +
      closingCosts +
      transferCosts +
      bondRegistrationCosts +
      attorneyFees +
      repairsRenovation +
      otherInitialCashCosts
  );

  const explicit = positiveAmount(input.explicitTotalCashInvested);

  let totalCashInvested: number | null = null;
  if (componentSum > 0) {
    totalCashInvested = explicit > componentSum ? round2(explicit) : componentSum;
  } else if (explicit > 0) {
    totalCashInvested = round2(explicit);
  }

  return {
    totalCashInvested,
    depositPayment,
    closingCosts,
    transferCosts,
    bondRegistrationCosts,
    attorneyFees,
    repairsRenovation,
    otherInitialCashCosts
  };
}

export function computeEquity(marketValue: number | null, loanBalance: number | null): number | null {
  if (marketValue == null || loanBalance == null) {
    if (marketValue != null && (loanBalance == null || loanBalance === 0)) return round2(marketValue);
    return null;
  }
  return round2(marketValue - loanBalance);
}

export function computeLtvPercent(loanAmount: number | null, marketValue: number | null, purchasePrice: number | null): number | null {
  const loan = loanAmount ?? null;
  const base = marketValue != null && marketValue > 0 ? marketValue : purchasePrice;
  if (loan == null || loan <= 0 || base == null || base <= 0) return null;
  return pct(loan, base);
}

export function computeGrossYieldPercent(annualIncome: number | null, purchasePrice: number | null): number | null {
  if (annualIncome == null || annualIncome <= 0 || purchasePrice == null || purchasePrice <= 0) return null;
  return pct(annualIncome, purchasePrice);
}

/** Net yield before financing = (income - operating expenses) / purchase price. */
export function computeNetYieldPercent(
  monthlyIncome: number | null,
  monthlyOperatingExpenses: number | null,
  purchasePrice: number | null
): number | null {
  if (monthlyIncome == null || monthlyOperatingExpenses == null || purchasePrice == null || purchasePrice <= 0) {
    return null;
  }
  const annualNoi = (monthlyIncome - monthlyOperatingExpenses) * 12;
  return pct(annualNoi, purchasePrice);
}

export function computeMonthlyCashFlow(
  effectiveMonthlyIncome: number | null,
  monthlyExpenses: number | null,
  monthlyLoanPayment: number | null,
  loanIncludedInExpenses: boolean
): number | null {
  if (effectiveMonthlyIncome == null) return null;
  const debt = loanIncludedInExpenses ? 0 : monthlyLoanPayment ?? 0;
  const expenses = monthlyExpenses ?? 0;
  return round2(effectiveMonthlyIncome - expenses - debt);
}

export function computeCashOnCashRoiPercent(annualCashFlow: number | null, cashInvested: number | null): number | null {
  if (annualCashFlow == null || cashInvested == null || cashInvested <= 0) return null;
  return pct(annualCashFlow, cashInvested);
}

export function computeCapRatePercent(
  monthlyIncome: number | null,
  monthlyOperatingExpenses: number | null,
  marketValue: number | null,
  purchasePrice: number | null
): number | null {
  if (monthlyIncome == null || monthlyOperatingExpenses == null) return null;
  const value = marketValue != null && marketValue > 0 ? marketValue : purchasePrice;
  if (value == null || value <= 0) return null;
  const annualNoi = (monthlyIncome - monthlyOperatingExpenses) * 12;
  if (annualNoi <= 0) return null;
  return pct(annualNoi, value);
}

export function computeTwoPercentRulePercent(monthlyRent: number | null, purchasePrice: number | null): number | null {
  if (monthlyRent == null || monthlyRent <= 0 || purchasePrice == null || purchasePrice <= 0) return null;
  return pct(monthlyRent, purchasePrice);
}

/** Monthly cash flow under 50% rule: income - 50% income - loan payment. */
export function computeFiftyPercentRuleCashFlow(monthlyIncome: number | null, monthlyLoanPayment: number | null): number | null {
  if (monthlyIncome == null) return null;
  const half = monthlyIncome * 0.5;
  const debt = monthlyLoanPayment ?? 0;
  return round2(monthlyIncome - half - debt);
}

export function meetsFiftyPercentRule(monthlyIncome: number | null, monthlyOperatingExpenses: number | null): boolean | null {
  if (monthlyIncome == null || monthlyIncome <= 0) return null;
  const operating = monthlyOperatingExpenses ?? 0;
  return operating <= monthlyIncome * 0.5 + 0.01;
}

export type InvestmentRating = "excellent" | "good" | "fair" | "weak";

export function deriveInvestmentRating(opts: {
  monthlyCashFlow: number | null;
  cashOnCashRoi: number | null;
  meetsFiftyPercent: boolean | null;
}): InvestmentRating | null {
  const { monthlyCashFlow, cashOnCashRoi, meetsFiftyPercent } = opts;
  if (monthlyCashFlow == null && cashOnCashRoi == null) return null;
  const coc = cashOnCashRoi ?? 0;
  const cf = monthlyCashFlow ?? 0;
  if (cf > 0 && meetsFiftyPercent === true && coc >= 8) return "excellent";
  if (cf > 0 && coc >= 5) return "good";
  if (meetsFiftyPercent === true || coc >= 3) return "fair";
  return "weak";
}

export type PropertyCalculatorResultMetrics = {
  monthlyCashFlow: number | null;
  annualCashFlow: number | null;
  grossYield: number | null;
  netYield: number | null;
  cashOnCashRoi: number | null;
  equity: number | null;
  ltv: number | null;
  capRate: number | null;
  twoPercentRule: number | null;
  fiftyPercentRule: number | null;
};

/** Standard metrics from monthly snapshot (portfolio / PDF assembly). */
export function computeMetricsFromMonthlySnapshot(opts: {
  monthlyIncome: number;
  monthlyOperatingExpenses: number;
  monthlyLoanPayment: number;
  purchasePrice: number | null;
  marketValue: number | null;
  loanBalance: number | null;
  loanAmount: number | null;
  cashInvested: number | null;
}): Pick<
  PropertyCalculatorResultMetrics,
  | "monthlyCashFlow"
  | "annualCashFlow"
  | "grossYield"
  | "netYield"
  | "cashOnCashRoi"
  | "equity"
  | "ltv"
  | "capRate"
  | "twoPercentRule"
  | "fiftyPercentRule"
> {
  const monthlyExpenses = opts.monthlyOperatingExpenses + opts.monthlyLoanPayment;
  const monthlyCashFlow = round2(opts.monthlyIncome - monthlyExpenses);
  const annualCashFlow = round2(monthlyCashFlow * 12);
  const annualIncome = round2(opts.monthlyIncome * 12);
  const valueForYield = opts.marketValue ?? opts.purchasePrice;

  return {
    monthlyCashFlow,
    annualCashFlow,
    grossYield:
      valueForYield != null && valueForYield > 0 && opts.monthlyIncome > 0
        ? pct(annualIncome, valueForYield)
        : computeGrossYieldPercent(annualIncome, opts.purchasePrice),
    netYield: computeNetYieldPercent(opts.monthlyIncome, opts.monthlyOperatingExpenses, opts.purchasePrice),
    cashOnCashRoi: computeCashOnCashRoiPercent(annualCashFlow, opts.cashInvested),
    equity: computeEquity(opts.marketValue, opts.loanBalance),
    ltv: computeLtvPercent(opts.loanAmount ?? opts.loanBalance, opts.marketValue, opts.purchasePrice),
    capRate: computeCapRatePercent(opts.monthlyIncome, opts.monthlyOperatingExpenses, opts.marketValue, opts.purchasePrice),
    twoPercentRule: computeTwoPercentRulePercent(opts.monthlyIncome, opts.purchasePrice),
    fiftyPercentRule: computeFiftyPercentRuleCashFlow(opts.monthlyIncome, opts.monthlyLoanPayment)
  };
}
