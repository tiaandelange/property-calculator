/**
 * Maps internal calculator/property field keys to user-facing PDF labels.
 * Server-side only — keep in sync with calculator question labels where possible.
 */

import { formatPdfZar } from "./pdfFormat.js";

export type ReportFieldKind = "currency" | "percentage" | "number" | "text" | "boolean";

export type ReportFieldMeta = {
  label: string;
  kind?: ReportFieldKind;
};

/** Canonical calculator answer keys → display labels (no camelCase in PDF). */
export const CALCULATOR_FIELD_LABELS: Record<string, ReportFieldMeta> = {
  purchasePrice: { label: "Purchase Price", kind: "currency" },
  marketValue: { label: "Market Value", kind: "currency" },
  closingCosts: { label: "Closing Costs", kind: "currency" },
  repairsRenovation: { label: "Repairs / Renovation", kind: "currency" },
  cashInvested: { label: "Cash Invested", kind: "currency" },
  loanAmount: { label: "Loan Amount", kind: "currency" },
  interestRateApr: { label: "Interest Rate", kind: "percentage" },
  loanTermYears: { label: "Loan Term", kind: "number" },
  amortizationYears: { label: "Amortization Period", kind: "number" },
  monthlyRent: { label: "Monthly Rent", kind: "currency" },
  unit1Rent: { label: "Monthly Rent — Unit 1", kind: "currency" },
  unit2Rent: { label: "Monthly Rent — Unit 2", kind: "currency" },
  ratesTaxesMonthly: { label: "Rates & Taxes", kind: "currency" },
  insuranceMonthly: { label: "Insurance", kind: "currency" },
  maintenanceReserveMonthly: { label: "Maintenance", kind: "currency" },
  managementFeePct: { label: "Management Fee", kind: "percentage" },
  vacancyAllowancePct: { label: "Vacancy Allowance", kind: "percentage" },
  occupancyPct: { label: "Occupancy", kind: "percentage" },
  hoaLeviesMonthly: { label: "HOA / Levies", kind: "currency" },
  utilitiesMonthly: { label: "Utilities", kind: "currency" },
  expectedAppreciationPct: { label: "Property Appreciation", kind: "percentage" },
  holdingCostsMonthly: { label: "Holding Costs", kind: "currency" },
  expectedSalePrice: { label: "Expected Sale Price", kind: "currency" }
};

export function getReportFieldLabel(key: string): string {
  const meta = CALCULATOR_FIELD_LABELS[key];
  if (meta?.label) return meta.label;
  return humanizeFieldKey(key);
}

export function humanizeFieldKey(key: string): string {
  const s = String(key ?? "").trim();
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(x) ? x : null;
}

export function formatReportFieldValue(key: string, raw: unknown): string {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  const meta = CALCULATOR_FIELD_LABELS[key];
  const n = parseNum(raw);
  if (n == null) {
    const s = String(raw).trim();
    return s.length ? s : "—";
  }
  if (meta?.kind === "currency") return formatPdfZar(n);
  if (meta?.kind === "percentage") return `${n.toFixed(2)}%`;
  if (meta?.kind === "number") return Number.isInteger(n) ? String(Math.round(n)) : n.toLocaleString("en-ZA");
  return String(raw);
}

export type ReportDisplayRow = { label: string; value: string };

export function buildCalculatorPropertyInformationRows(
  answers: Record<string, unknown>,
  metrics: Record<string, unknown>,
  propertyTypeLabel: string
): ReportDisplayRow[] {
  const pick = (key: string) => formatReportFieldValue(key, answers[key]);
  const purchase = parseNum(answers.purchasePrice);
  const market = parseNum(answers.marketValue);
  const closing = parseNum(answers.closingCosts) ?? 0;
  const repairs = parseNum(answers.repairsRenovation) ?? 0;
  const totalProject =
    purchase != null ? purchase + closing + repairs : null;
  const cash = parseNum(answers.cashInvested);
  const loan = parseNum(answers.loanAmount);
  const ltv = metrics.ltv;

  return [
    { label: "Property Type", value: propertyTypeLabel || "—" },
    { label: "Purchase Price", value: pick("purchasePrice") },
    { label: "Market Value", value: pick("marketValue") },
    { label: "Closing Costs", value: pick("closingCosts") },
    { label: "Repairs / Renovation", value: pick("repairsRenovation") },
    {
      label: "Total Project Cost",
      value: totalProject != null && totalProject > 0 ? formatPdfZar(totalProject) : "—"
    },
    { label: "Cash Invested / Deposit", value: pick("cashInvested") },
    { label: "Loan Amount", value: pick("loanAmount") },
    {
      label: "Loan-to-Value",
      value: ltv != null && Number.isFinite(Number(ltv)) ? `${Number(ltv).toFixed(2)}%` : "—"
    }
  ];
}

export function buildCalculatorIncomeExpenseRows(
  answers: Record<string, unknown>,
  metrics: Record<string, unknown>
): ReportDisplayRow[] {
  const monthlyIncome = parseNum(metrics.monthlyIncome);
  const monthlyExpenses = parseNum(metrics.monthlyExpenses);
  const cashFlow = parseNum(metrics.projectedCashFlow ?? metrics.monthlyCashFlow);
  const vacancyPct = parseNum(answers.vacancyAllowancePct);
  const effectiveIncome =
    monthlyIncome != null && vacancyPct != null
      ? monthlyIncome * (1 - Math.min(100, Math.max(0, vacancyPct)) / 100)
      : monthlyIncome;

  const fmt = (n: number | null) => (n == null ? "—" : formatPdfZar(n));
  const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}%`);

  return [
    { label: "Gross Rent / Monthly Income", value: fmt(monthlyIncome) },
    { label: "Vacancy Allowance", value: fmtPct(vacancyPct) },
    { label: "Effective Monthly Income", value: fmt(effectiveIncome) },
    { label: "Rates & Taxes", value: formatReportFieldValue("ratesTaxesMonthly", answers.ratesTaxesMonthly) },
    { label: "Insurance", value: formatReportFieldValue("insuranceMonthly", answers.insuranceMonthly) },
    { label: "Maintenance", value: formatReportFieldValue("maintenanceReserveMonthly", answers.maintenanceReserveMonthly) },
    {
      label: "Management Fee",
      value: formatReportFieldValue("managementFeePct", answers.managementFeePct)
    },
    { label: "HOA / Levies", value: formatReportFieldValue("hoaLeviesMonthly", answers.hoaLeviesMonthly) },
    { label: "Utilities", value: formatReportFieldValue("utilitiesMonthly", answers.utilitiesMonthly) },
    { label: "Total Monthly Expenses", value: fmt(monthlyExpenses) },
    { label: "Net Monthly Cash Flow", value: fmt(cashFlow) }
  ];
}

export function buildCalculatorLoanAssumptionRows(
  answers: Record<string, unknown>,
  metrics: Record<string, unknown>
): ReportDisplayRow[] {
  const bondPmt = parseNum(metrics.monthlyBondPayment);
  const termYears = parseNum(answers.loanTermYears) ?? parseNum(answers.amortizationYears);
  const termLabel =
    termYears != null && Number.isFinite(termYears) ? `${Math.round(termYears)} years` : "—";

  return [
    { label: "Loan Term", value: termLabel },
    { label: "Interest Rate", value: formatReportFieldValue("interestRateApr", answers.interestRateApr) },
    {
      label: "Monthly Loan Payment",
      value: bondPmt != null ? formatPdfZar(bondPmt) : "—"
    },
    { label: "Annual Rent Growth", value: "—" },
    { label: "Expense Growth / Inflation", value: "—" },
    {
      label: "Property Appreciation",
      value: formatReportFieldValue("expectedAppreciationPct", answers.expectedAppreciationPct)
    },
    { label: "Holding Period", value: "30 years" }
  ];
}
