/** Nominal annual % used only when property bond rate is unset — IRR/expense baseline hint (set actual rate on the property). */
export const IRR_EXPENSE_BASELINE_BOND_RATE_FALLBACK_PERCENT = 11.75;

/** Allowed original bond lengths in the product UI (years). */
export const ALLOWED_BOND_TERM_YEARS = [5, 10, 15, 20, 25, 30] as const;
export type BondTermYears = (typeof ALLOWED_BOND_TERM_YEARS)[number];

const ALLOWED_BOND_TERM_SET = new Set<number>(ALLOWED_BOND_TERM_YEARS);

/** Calendar months from bond start → `asOf` (day-of-month aware). Dates interpreted in UTC date-only via ISO slice. */
export function calendarMonthsElapsedBond(start: Date, asOf: Date = new Date()): number {
  const isoA = start.toISOString().slice(0, 10);
  const isoB = asOf.toISOString().slice(0, 10);
  const [ya, ma, da] = isoA.split("-").map(Number);
  const [yb, mb, db] = isoB.split("-").map(Number);
  if (!ya || !ma || !da || !yb || !mb || !db) return 0;
  let months = (yb - ya) * 12 + (mb - ma);
  if (db < da) months -= 1;
  return Math.max(0, months);
}

export function isAllowedBondTermYears(v: unknown): v is BondTermYears {
  const n = Number(v);
  return Number.isInteger(n) && ALLOWED_BOND_TERM_SET.has(n);
}

export type ResolvedBondRemaining = {
  remainingMonths: number | null;
  totalTermMonths: number | null;
  monthsElapsed: number | null;
  scheduleUsed: boolean;
};

/**
 * Prefer bond term (years) + start date → remaining months.
 * Fallback: stored `bondRemainingTermMonths` when schedule incomplete.
 */
export function resolveBondRemainingMonths(
  property: {
    bondTermYears?: number | null;
    bondStartDate?: Date | string | null;
    bondRemainingTermMonths?: number | null;
  },
  asOf: Date = new Date()
): ResolvedBondRemaining {
  const tyRaw = property.bondTermYears;
  const ty = tyRaw != null && isAllowedBondTermYears(tyRaw) ? (Number(tyRaw) as BondTermYears) : null;
  const sd = property.bondStartDate;
  let startDate: Date | null = null;
  if (sd != null) {
    const d = sd instanceof Date ? sd : new Date(String(sd));
    startDate = Number.isNaN(d.getTime()) ? null : d;
  }

  if (ty != null && startDate != null) {
    const total = ty * 12;
    const elapsed = calendarMonthsElapsedBond(startDate, asOf);
    const cappedElapsed = Math.min(elapsed, total);
    const remaining = Math.max(0, total - cappedElapsed);
    return {
      remainingMonths: remaining,
      totalTermMonths: total,
      monthsElapsed: cappedElapsed,
      scheduleUsed: true
    };
  }

  const manual =
    property.bondRemainingTermMonths != null && Number.isFinite(Number(property.bondRemainingTermMonths))
      ? Math.max(0, Math.floor(Number(property.bondRemainingTermMonths)))
      : null;

  return {
    remainingMonths: manual,
    totalTermMonths: null,
    monthsElapsed: null,
    scheduleUsed: false
  };
}

/** Monthly repayment on an amortising loan (positive principal, annual nominal %, remaining payments). */
export function amortizingMonthlyPayment(principal: number, annualPercent: number, remainingMonths: number): number | null {
  const p = Number(principal);
  const n = Math.floor(Number(remainingMonths));
  if (!(p > 0) || !(n > 0)) return null;
  const apr = Number(annualPercent);
  if (!Number.isFinite(apr)) return null;
  const i = apr / 100 / 12;
  if (i <= 1e-15) return Math.round((p / n) * 100) / 100;
  const pow = Math.pow(1 + i, n);
  const pmt = (p * i * pow) / (pow - 1);
  return Math.round(pmt * 100) / 100;
}

export function monthlyInterestFromAnnualPercent(balance: number, annualPercent: number): number {
  const b = Math.max(0, Number(balance));
  const i = Number(annualPercent) / 100 / 12;
  return Math.round(b * i * 100) / 100;
}

export type InferredBondExpenseBaselineResult = {
  monthlyPayment: number;
  /** True when `bondAnnualInterestRatePercent` was missing or invalid — placeholder rate applied. */
  usedFallbackNominalRate: boolean;
};

/**
 * Derive a monthly bond instalment from outstanding balance + nominal rate + remaining term so IRR / expense
 * baselines include debt service when the ledger omits bond rows. Uses {@link IRR_EXPENSE_BASELINE_BOND_RATE_FALLBACK_PERCENT}
 * when the property rate is unset. Falls back to interest-only on the balance if amortisation cannot be computed.
 */
export function inferMonthlyBondPaymentForExpenseBaseline(
  property: any,
  asOf: Date
): InferredBondExpenseBaselineResult | null {
  const balance = Number(property?.outstandingBondBalance);
  if (!Number.isFinite(balance) || balance <= 0) return null;

  let ratePct =
    property?.bondAnnualInterestRatePercent != null && property.bondAnnualInterestRatePercent !== ""
      ? Number(property.bondAnnualInterestRatePercent)
      : NaN;
  let usedFallbackNominalRate = false;
  if (!Number.isFinite(ratePct) || ratePct <= 0) {
    ratePct = IRR_EXPENSE_BASELINE_BOND_RATE_FALLBACK_PERCENT;
    usedFallbackNominalRate = true;
  }

  const resolved = resolveBondRemainingMonths(property, asOf);
  let rem = resolved.remainingMonths;
  if (rem == null || rem <= 0) {
    const tyRaw = property?.bondTermYears;
    const ty = tyRaw != null && isAllowedBondTermYears(tyRaw) ? Number(tyRaw) : NaN;
    if (Number.isFinite(ty) && ty > 0) rem = Math.round(ty * 12);
  }
  if (rem != null && rem > 0) {
    const pmt = amortizingMonthlyPayment(balance, ratePct, rem);
    if (pmt != null && pmt > 0) return { monthlyPayment: pmt, usedFallbackNominalRate };
  }
  const interestOnly = monthlyInterestFromAnnualPercent(balance, ratePct);
  if (interestOnly > 0) return { monthlyPayment: interestOnly, usedFallbackNominalRate };
  return null;
}

export type PropertyBondFinanceSnapshot = {
  outstandingBalance: number;
  annualInterestRatePercent: number | null;
  remainingTermMonths: number | null;
  /** When set with start date, drives `remainingTermMonths`. */
  bondTermYears: number | null;
  bondStartDate: string | null;
  totalBondTermMonths: number | null;
  monthsElapsedOnBond: number | null;
  remainingFromSchedule: boolean;
  calculatedMonthlyPayment: number | null;
  calculatedInterestPortion: number | null;
  calculatedPrincipalPortion: number | null;
  monthlyBondPaymentStored: number | null;
  bondInterestPortionOverride: number | null;
  bondPrincipalPortionOverride: number | null;
  paymentThisMonth: number;
  interestThisMonth: number;
  principalThisMonth: number;
  projectedBalanceAfterPayment: number;
};

/**
 * Snapshot for UI + summaries: combines stored property bond fields with amortisation maths.
 * Overrides on the property row adjust interest/principal when the bank differs from the formula.
 */
export function computePropertyBondFinance(
  property: {
    outstandingBondBalance?: number | null;
    monthlyBondPayment?: number | null;
    bondAnnualInterestRatePercent?: number | null;
    bondTermYears?: number | null;
    bondStartDate?: Date | string | null;
    bondRemainingTermMonths?: number | null;
    bondInterestPortionOverride?: number | null;
    bondPrincipalPortionOverride?: number | null;
  },
  asOf: Date = new Date()
): PropertyBondFinanceSnapshot {
  const balance = Math.max(0, Number(property.outstandingBondBalance ?? 0));
  const rate =
    property.bondAnnualInterestRatePercent != null && Number.isFinite(Number(property.bondAnnualInterestRatePercent))
      ? Number(property.bondAnnualInterestRatePercent)
      : null;

  const resolved = resolveBondRemainingMonths(property, asOf);
  const nRem = resolved.remainingMonths;

  const bondTermYears =
    property.bondTermYears != null && isAllowedBondTermYears(property.bondTermYears) ? Number(property.bondTermYears) : null;
  let bondStartDate: string | null = null;
  if (property.bondStartDate != null) {
    const d = property.bondStartDate instanceof Date ? property.bondStartDate : new Date(String(property.bondStartDate));
    bondStartDate = Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const calculatedMonthlyPayment =
    rate != null && nRem != null && nRem > 0 && balance > 0 ? amortizingMonthlyPayment(balance, rate, nRem) : null;

  const calculatedInterestPortion =
    rate != null && balance > 0 ? monthlyInterestFromAnnualPercent(balance, rate) : balance > 0 ? 0 : null;

  let calculatedPrincipalPortion: number | null = null;
  if (calculatedMonthlyPayment != null && calculatedInterestPortion != null) {
    calculatedPrincipalPortion = Math.round(Math.max(0, calculatedMonthlyPayment - calculatedInterestPortion) * 100) / 100;
  }

  const storedPayment =
    property.monthlyBondPayment != null && Number.isFinite(Number(property.monthlyBondPayment))
      ? Math.max(0, Number(property.monthlyBondPayment))
      : null;

  const paymentThisMonth = storedPayment ?? calculatedMonthlyPayment ?? 0;

  let interestThisMonth =
    property.bondInterestPortionOverride != null && Number.isFinite(Number(property.bondInterestPortionOverride))
      ? Math.max(0, Number(property.bondInterestPortionOverride))
      : calculatedInterestPortion ?? 0;

  interestThisMonth = Math.round(Math.min(interestThisMonth, paymentThisMonth) * 100) / 100;

  let principalThisMonth =
    property.bondPrincipalPortionOverride != null && Number.isFinite(Number(property.bondPrincipalPortionOverride))
      ? Math.max(0, Number(property.bondPrincipalPortionOverride))
      : Math.round(Math.max(0, paymentThisMonth - interestThisMonth) * 100) / 100;

  if (property.bondPrincipalPortionOverride != null && Number.isFinite(Number(property.bondPrincipalPortionOverride))) {
    principalThisMonth = Math.round(Math.max(0, Number(property.bondPrincipalPortionOverride)) * 100) / 100;
    interestThisMonth = Math.round(Math.max(0, paymentThisMonth - principalThisMonth) * 100) / 100;
  }

  const projectedBalanceAfterPayment = Math.round(Math.max(0, balance - principalThisMonth) * 100) / 100;

  return {
    outstandingBalance: balance,
    annualInterestRatePercent: rate,
    remainingTermMonths: nRem,
    bondTermYears,
    bondStartDate,
    totalBondTermMonths: resolved.totalTermMonths,
    monthsElapsedOnBond: resolved.monthsElapsed,
    remainingFromSchedule: resolved.scheduleUsed,
    calculatedMonthlyPayment,
    calculatedInterestPortion,
    calculatedPrincipalPortion,
    monthlyBondPaymentStored: storedPayment,
    bondInterestPortionOverride:
      property.bondInterestPortionOverride != null && Number.isFinite(Number(property.bondInterestPortionOverride))
        ? Number(property.bondInterestPortionOverride)
        : null,
    bondPrincipalPortionOverride:
      property.bondPrincipalPortionOverride != null && Number.isFinite(Number(property.bondPrincipalPortionOverride))
        ? Number(property.bondPrincipalPortionOverride)
        : null,
    paymentThisMonth: Math.round(paymentThisMonth * 100) / 100,
    interestThisMonth,
    principalThisMonth,
    projectedBalanceAfterPayment
  };
}
