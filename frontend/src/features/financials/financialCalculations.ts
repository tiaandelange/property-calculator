/** Parse a numeric field; returns null when missing or non-finite. */
export function parseFinancialNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function computeEquity(marketValue: number | null, loanBalance: number | null): number | null {
  if (marketValue == null || loanBalance == null) return null;
  return marketValue - loanBalance;
}

/** Total cash invested from property create/edit (deposit + transfer + renovation, etc.). */
export function resolveCashInvested(property: Record<string, unknown>): number | null {
  const raw = parseFinancialNumber(property.totalCashInvested);
  if (raw == null || raw <= 0) return null;
  return raw;
}

/** Annual cash-on-cash ROI = (monthly cash flow × 12 / cash invested) × 100. */
export function computeCashOnCashRoiPercent(
  monthlyCashFlow: number | null,
  cashInvested: number | null
): number | null {
  if (monthlyCashFlow == null || cashInvested == null || cashInvested <= 0) return null;
  return Number(((monthlyCashFlow * 12 * 100) / cashInvested).toFixed(2));
}

/** Gross yield on purchase price = (monthly income × 12 / purchase price) × 100. */
export function computeGrossYieldPercent(monthlyIncome: number, purchasePrice: number | null): number | null {
  if (purchasePrice == null || purchasePrice <= 0 || monthlyIncome <= 0) return null;
  return Number((((monthlyIncome * 12) / purchasePrice) * 100).toFixed(2));
}

/** Net yield on purchase price = (net cash flow × 12 / purchase price) × 100. */
export function computeNetYieldPercent(netCashFlow: number, purchasePrice: number | null): number | null {
  if (purchasePrice == null || purchasePrice <= 0) return null;
  return Number((((netCashFlow * 12) / purchasePrice) * 100).toFixed(2));
}
