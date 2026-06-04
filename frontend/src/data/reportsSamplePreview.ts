import { formatRand, monthlyBondRepayment } from "../utils/mortgageRepayment";

/** Static demo inputs for the public sample report preview (no API / auth). */
export const REPORTS_SAMPLE_PROPERTY = {
  name: "Sample Coastal Duplex",
  location: "Betty’s Bay, Western Cape",
  purchasePrice: 2_400_000,
  marketValue: 2_850_000,
  monthlyRentalIncome: 28_000,
  vacancyPercent: 5,
  operatingExpensesMonthly: 6_850,
  bondAmount: 1_920_000,
  interestRatePercent: 10.75,
  loanTermYears: 20,
  landlordName: "Proplytic Demo Portfolio",
  landlordLine: "Cape Town, South Africa"
} as const;

function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function buildReportsSampleMetrics() {
  const p = REPORTS_SAMPLE_PROPERTY;
  const effectiveMonthlyRent = p.monthlyRentalIncome * (1 - p.vacancyPercent / 100);
  const monthlyBondPayment = monthlyBondRepayment(p.bondAmount, p.interestRatePercent, p.loanTermYears);
  const netOperatingIncome = effectiveMonthlyRent - p.operatingExpensesMonthly;
  const netCashFlow = netOperatingIncome - monthlyBondPayment;
  const grossYield = ((p.monthlyRentalIncome * 12) / p.marketValue) * 100;
  const expenseRatio = (p.operatingExpensesMonthly / p.monthlyRentalIncome) * 100;
  const loanToValue = (p.bondAmount / p.marketValue) * 100;
  const cashInvested = p.purchasePrice - p.bondAmount;
  const annualNetCashFlow = netCashFlow * 12;
  const cashOnCash = cashInvested > 0 ? (annualNetCashFlow / cashInvested) * 100 : 0;
  const estimatedEquity = p.marketValue - p.bondAmount;

  return {
    effectiveMonthlyRent,
    monthlyBondPayment,
    netOperatingIncome,
    netCashFlow,
    grossYield,
    expenseRatio,
    loanToValue,
    cashOnCash,
    estimatedEquity,
    cashInvested,
    format: {
      marketValue: formatRand(p.marketValue),
      monthlyRentalIncome: formatRand(p.monthlyRentalIncome),
      effectiveRent: formatRand(effectiveMonthlyRent),
      operatingExpenses: formatRand(p.operatingExpensesMonthly),
      monthlyBondPayment: formatRand(monthlyBondPayment),
      netOperatingIncome: formatRand(netOperatingIncome),
      netCashFlow: formatRand(netCashFlow),
      annualNetCashFlow: formatRand(annualNetCashFlow),
      grossYield: pct(grossYield),
      expenseRatio: pct(expenseRatio),
      loanToValue: pct(loanToValue),
      cashOnCash: pct(cashOnCash),
      estimatedEquity: formatRand(estimatedEquity),
      purchasePrice: formatRand(p.purchasePrice),
      bondAmount: formatRand(p.bondAmount),
      cashInvested: formatRand(cashInvested)
    }
  };
}

export type ReportsSampleMetrics = ReturnType<typeof buildReportsSampleMetrics>;
