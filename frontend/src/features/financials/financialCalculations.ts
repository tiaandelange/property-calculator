/**
 * Financial helpers for property pages.
 * Core formulas live in `@propertyCalculator` — these wrappers preserve the monthly-input API.
 */
import {
  computeCashOnCashRoiPercent as computeCashOnCashRoiFromAnnual,
  computeEquity as computeEquityShared,
  computeGrossYieldPercent as computeGrossYieldFromAnnual,
  pct
} from "@propertyCalculator/financialMetrics";

export function parseFinancialNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function computeEquity(marketValue: number | null, loanBalance: number | null): number | null {
  return computeEquityShared(marketValue, loanBalance);
}

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
  return computeCashOnCashRoiFromAnnual(monthlyCashFlow * 12, cashInvested);
}

/** Gross yield on purchase price = (monthly income × 12 / purchase price) × 100. */
export function computeGrossYieldPercent(monthlyIncome: number, purchasePrice: number | null): number | null {
  if (purchasePrice == null || purchasePrice <= 0 || monthlyIncome <= 0) return null;
  return computeGrossYieldFromAnnual(monthlyIncome * 12, purchasePrice);
}

/** Net yield on purchase price = (net cash flow × 12 / purchase price) × 100. */
export function computeNetYieldPercent(netCashFlow: number, purchasePrice: number | null): number | null {
  if (purchasePrice == null || purchasePrice <= 0) return null;
  return pct(netCashFlow * 12, purchasePrice);
}
