import { calculateMonthlyBondPayment } from "@calculatorShared/calculatorHelpers";

/** Frontend-only: derive engine monthlyBondPayment from bond amount + rate + term. */
export function applyCashFlowBondPaymentPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const bondAmount = Number(payload.bondAmount);
  const rate = Number(payload.annualInterestRate);
  const term = Number(payload.loanTermYears);

  if (Number.isFinite(bondAmount) && bondAmount > 0 && Number.isFinite(rate) && rate >= 0 && Number.isFinite(term) && term > 0) {
    const { monthlyPayment } = calculateMonthlyBondPayment({
      principal: bondAmount,
      annualInterestRatePercent: rate,
      termYears: term
    });
    payload.monthlyBondPayment = Math.round((monthlyPayment + Number.EPSILON) * 100) / 100;
  } else {
    payload.monthlyBondPayment = Number(payload.monthlyBondPayment) || 0;
  }

  delete payload.bondAmount;
  delete payload.annualInterestRate;
  delete payload.loanTermYears;
  return payload;
}

export function computeCashFlowMonthlyBondPayment(values: Record<string, unknown>): number | null {
  const bondAmount = Number(values.bondAmount);
  const rate = Number(values.annualInterestRate);
  const term = Number(values.loanTermYears);
  if (!Number.isFinite(bondAmount) || bondAmount <= 0 || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(term) || term <= 0) {
    return null;
  }
  const { monthlyPayment } = calculateMonthlyBondPayment({
    principal: bondAmount,
    annualInterestRatePercent: rate,
    termYears: term
  });
  return Math.round((monthlyPayment + Number.EPSILON) * 100) / 100;
}
