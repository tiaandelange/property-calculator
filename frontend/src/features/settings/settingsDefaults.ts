import type { StatementDefaultFilter, UserSettings } from "./settingsTypes";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  themePreference: "system",
  accentColor: "purple",
  density: "comfortable",
  defaultCurrency: "ZAR",
  statementDefaultFilter: "6_months",
  leaseDefaultTermMonths: 12,
  defaultRentDueDay: 1,
  recurringExpenseDefaultCategory: "maintenance",
  autoGenerateInvoices: true,
  invoiceGenerateDaysBeforeDue: 10,
  invoiceNumberFormat: "INV-YYYY-{####}",
  pdfBrandingEnabled: true,
  paymentReminderDaysBeforeDue: 3,
  overdueAlertsEnabled: true,
  monthlySummariesEnabled: true,
  newLeaseAlertsEnabled: false,
  lockInvoiceAfterSent: true
};

export const STATEMENT_FILTER_OPTIONS: Array<{ value: StatementDefaultFilter; label: string }> = [
  { value: "last_month", label: "Last month" },
  { value: "6_months", label: "6 months" },
  { value: "ytd", label: "Year to date" },
  { value: "12_months", label: "12 months" },
  { value: "per_year", label: "Per year" },
  { value: "forever", label: "Forever" }
];

export const EXPENSE_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "maintenance", label: "Maintenance" },
  { value: "rates_taxes", label: "Rates & taxes" },
  { value: "water", label: "Water" },
  { value: "electricity", label: "Electricity" },
  { value: "levies", label: "Levies" },
  { value: "insurance", label: "Insurance" },
  { value: "repairs", label: "Repairs" },
  { value: "management_fees", label: "Management fees" },
  { value: "accounting", label: "Accounting" },
  { value: "other", label: "Other" }
];

export function expenseCategoryToApi(slug: string): string {
  const map: Record<string, string> = {
    maintenance: "MAINTENANCE",
    rates_taxes: "RATES_TAXES",
    water: "WATER",
    electricity: "ELECTRICITY",
    levies: "LEVIES",
    insurance: "INSURANCE",
    repairs: "REPAIRS",
    management_fees: "MANAGEMENT_FEES",
    accounting: "ACCOUNTING",
    other: "OTHER"
  };
  return map[slug] ?? "MAINTENANCE";
}

export function statementFilterToPreset(filter: StatementDefaultFilter): string {
  const map: Record<StatementDefaultFilter, string> = {
    last_month: "LAST_MONTH",
    "6_months": "SIX_MONTHS",
    ytd: "YTD",
    "12_months": "TWELVE_MONTHS",
    per_year: "PER_YEAR",
    forever: "FOREVER"
  };
  return map[filter] ?? "SIX_MONTHS";
}

export function presetToStatementFilter(preset: string): StatementDefaultFilter {
  const map: Record<string, StatementDefaultFilter> = {
    LAST_MONTH: "last_month",
    SIX_MONTHS: "6_months",
    YTD: "ytd",
    TWELVE_MONTHS: "12_months",
    PER_YEAR: "per_year",
    FOREVER: "forever"
  };
  return map[preset] ?? "6_months";
}
