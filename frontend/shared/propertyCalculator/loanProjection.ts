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
  return Math.round(balance * 100) / 100;
}
