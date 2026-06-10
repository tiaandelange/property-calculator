import type { PropertyCalculatorResult } from "./calculatorTypes";

export type ReportMetricCard = {
  label: string;
  value: string;
  helperText?: string;
};

export type ReportKeyValueRow = { label: string; value: string };

export type MappedInvestmentReportMetrics = {
  metricCards: ReportMetricCard[];
  incomeExpenseRows: ReportKeyValueRow[];
  assumptionRows: ReportKeyValueRow[];
  analysisRows: ReportKeyValueRow[];
  fiftyPercentRows: ReportKeyValueRow[];
  twoPercentRows: ReportKeyValueRow[];
  investmentRatingLabel: string | null;
};

function formatCurrency(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `R ${Math.round(amount).toLocaleString("en-ZA")}`;
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export function mapCalculatorResultToReportSections(
  result: PropertyCalculatorResult,
  opts?: { propertyName?: string }
): MappedInvestmentReportMetrics {
  const ratingLabel =
    result.investmentRating != null
      ? result.investmentRating.charAt(0).toUpperCase() + result.investmentRating.slice(1)
      : null;

  return {
    metricCards: [
      { label: "Monthly Income", value: formatCurrency(result.effectiveMonthlyIncome) },
      { label: "Monthly Expenses", value: formatCurrency(result.monthlyExpenses) },
      { label: "Monthly Cash Flow", value: formatCurrency(result.monthlyCashFlow) },
      { label: "IRR", value: formatPct(result.irr), helperText: "Annualised return to exit" },
      { label: "Cash on Cash ROI", value: formatPct(result.cashOnCashRoi), helperText: "Annualized" },
      { label: "Gross Yield", value: formatPct(result.grossYield) },
      { label: "Cap Rate", value: formatPct(result.capRate) },
      { label: "Equity", value: formatCurrency(result.equity) },
      { label: "LTV", value: formatPct(result.ltv) }
    ],
    incomeExpenseRows: [
      { label: "Gross monthly income", value: formatCurrency(result.monthlyIncome) },
      { label: "Effective monthly income", value: formatCurrency(result.effectiveMonthlyIncome) },
      { label: "Monthly operating expenses", value: formatCurrency(result.monthlyExpenses != null && result.monthlyLoanPayment != null ? result.monthlyExpenses - result.monthlyLoanPayment : result.monthlyExpenses) },
      { label: "Monthly loan payment", value: formatCurrency(result.monthlyLoanPayment) },
      { label: "Net monthly cash flow", value: formatCurrency(result.monthlyCashFlow) }
    ],
    assumptionRows: [
      { label: "Total project cost", value: formatCurrency(result.totalProjectCost) },
      { label: "Occupancy", value: result.occupancyRate != null ? formatPct(result.occupancyRate) : "—" },
      { label: "Units occupied", value: result.unitsOccupied != null && result.totalUnits != null ? `${result.unitsOccupied} / ${result.totalUnits}` : "—" }
    ],
    analysisRows: [
      ...result.projectedYears.map((year, index) => ({
        label: `Year ${year} projected cash flow`,
        value: formatCurrency(result.projectedCashFlow[index] ?? null)
      })),
      ...result.irrByYear.map((row) => ({
        label: `Year ${row.year} IRR`,
        value: formatPct(row.irr)
      }))
    ],
    fiftyPercentRows: [
      { label: "50% rule cash flow", value: formatCurrency(result.fiftyPercentRule) },
      {
        label: "50% rule status",
        value:
          result.fiftyPercentRule == null
            ? "—"
            : result.fiftyPercentRule >= 0
              ? "Meets 50% Rule"
              : "Does Not Meet 50% Rule"
      }
    ],
    twoPercentRows: [{ label: "2% Rule", value: formatPct(result.twoPercentRule) }],
    investmentRatingLabel: ratingLabel
  };
}

export function mapCalculatorResultToLegacyMetrics(result: PropertyCalculatorResult): Record<string, unknown> {
  return {
    monthlyIncome: result.effectiveMonthlyIncome,
    monthlyExpenses: result.monthlyExpenses,
    projectedCashFlow: result.monthlyCashFlow,
    monthlyCashFlow: result.monthlyCashFlow,
    annualCashFlow: result.annualCashFlow,
    grossYield: result.grossYield,
    netYield: result.netYield,
    cashOnCashRoi: result.cashOnCashRoi,
    internalRateofReturn: result.irr,
    internalRateOfReturn: result.irr,
    irrByYear: result.irrByYear,
    ltv: result.ltv,
    monthlyBondPayment: result.monthlyLoanPayment,
    unitsOccupied:
      result.unitsOccupied != null && result.totalUnits != null
        ? { occupied: result.unitsOccupied, total: result.totalUnits }
        : null
  };
}
