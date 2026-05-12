/** Hub defaults: SA-style bond repayment (no extras). */

export const HUB_MORTGAGE_PRICE_MIN = 500_000;
export const HUB_MORTGAGE_PRICE_MAX = 5_000_000;
export const HUB_MORTGAGE_PRICE_STEP = 100_000;

export function snapPriceToStep(value: number): number {
  const clamped = Math.min(HUB_MORTGAGE_PRICE_MAX, Math.max(HUB_MORTGAGE_PRICE_MIN, value));
  const snapped =
    Math.round((clamped - HUB_MORTGAGE_PRICE_MIN) / HUB_MORTGAGE_PRICE_STEP) * HUB_MORTGAGE_PRICE_STEP +
    HUB_MORTGAGE_PRICE_MIN;
  return Math.min(HUB_MORTGAGE_PRICE_MAX, Math.max(HUB_MORTGAGE_PRICE_MIN, snapped));
}

export function monthlyBondRepayment(principal: number, annualRatePercent: number, termYears: number): number {
  if (!(principal > 0) || !(termYears > 0)) return 0;
  const n = Math.round(termYears * 12);
  const r = annualRatePercent / 100 / 12;
  if (r <= 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

/** Remaining principal after `paymentsMade` full scheduled payments (standard amortisation). */
export function remainingBalanceAfterPayments(
  principal: number,
  annualRatePercent: number,
  termYears: number,
  paymentsMade: number
): number {
  if (!(principal > 0) || !(termYears > 0)) return 0;
  const n = Math.round(termYears * 12);
  const k = Math.min(Math.max(0, Math.floor(paymentsMade)), n);
  const r = annualRatePercent / 100 / 12;
  if (r <= 0) return Math.max(0, principal - (principal / n) * k);
  const factorN = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, k);
  return (principal * (factorN - factorK)) / (factorN - 1);
}

export type MortgageYearPoint = {
  year: number;
  balance: number;
  totalPaid: number;
};

/** One point per year (0 … termYears) for charts. */
export function mortgageYearlySeries(
  loanPrincipal: number,
  annualRatePercent: number,
  termYears: number
): MortgageYearPoint[] {
  const pmt = monthlyBondRepayment(loanPrincipal, annualRatePercent, termYears);
  const n = Math.round(termYears * 12);
  const out: MortgageYearPoint[] = [];
  for (let y = 0; y <= Math.ceil(termYears); y++) {
    const months = Math.min(y * 12, n);
    const balance = remainingBalanceAfterPayments(loanPrincipal, annualRatePercent, termYears, months);
    const totalPaid = Math.min(months * pmt, pmt * n);
    out.push({ year: y, balance, totalPaid });
  }
  return out;
}

export function formatRand(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 2 : 0
  }).format(Number.isFinite(value) ? value : 0);
}
