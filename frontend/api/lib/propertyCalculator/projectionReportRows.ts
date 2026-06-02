import type { PropertyCalculatorResult } from "./calculatorTypes";

export type ProjectionReportRow = {
  label: string;
  values: (string | number | null)[];
};

function irrForYear(result: PropertyCalculatorResult, year: number): number | null {
  return result.irrByYear.find((row) => row.year === year)?.irr ?? null;
}

/** Builds Analysis Over Time rows for PDF/report tables (values are raw numbers; format at render). */
export function buildProjectionReportRows(result: PropertyCalculatorResult): ProjectionReportRow[] {
  const years = result.projectedYears;
  return [
    { label: "Total annual income", values: years.map((_, i) => result.projectedIncome[i] ?? null) },
    { label: "Total annual expenses", values: years.map((_, i) => result.projectedExpenses[i] ?? null) },
    {
      label: "Total annual cash flow",
      values: years.map((_, i) => result.projectedCashFlow[i] ?? null)
    },
    { label: "Property value", values: years.map((_, i) => result.projectedPropertyValue[i] ?? null) },
    { label: "Equity", values: years.map((_, i) => result.projectedEquity[i] ?? null) },
    { label: "Loan balance", values: years.map((_, i) => result.projectedLoanBalance[i] ?? null) },
    { label: "IRR", values: years.map((year) => irrForYear(result, year)) }
  ];
}
