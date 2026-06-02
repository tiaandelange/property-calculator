import type { ApplicantFormTemplate } from "../applicants/applicantFormTemplate";

export type ThemePreference = "light" | "dark" | "system";

export type AccentColor = "purple" | "blue" | "green" | "orange" | "red" | "teal";

export type DensityPreference = "comfortable" | "compact";

export type StatementDefaultFilter =
  | "last_month"
  | "6_months"
  | "ytd"
  | "12_months"
  | "per_year"
  | "forever";

export type UserSettings = {
  themePreference: ThemePreference;
  accentColor: AccentColor;
  density: DensityPreference;
  defaultCurrency: string;
  statementDefaultFilter: StatementDefaultFilter;
  /** Annual income growth (%) p.a. used for forward-looking projections. */
  annualIncomeGrowthPercentAnnual: number;
  /** Annual expense growth / inflation (%) p.a. used for forward-looking projections. */
  expenseGrowthPercentAnnual: number;
  /** Annual property appreciation (%) p.a. used for forward-looking projections. */
  propertyAppreciationPercentAnnual: number;
  leaseDefaultTermMonths: number;
  defaultRentDueDay: number;
  recurringExpenseDefaultCategory: string;
  autoGenerateInvoices: boolean;
  invoiceGenerateDaysBeforeDue: number;
  invoiceNumberFormat: string;
  pdfBrandingEnabled: boolean;
  /** When true, invoices/PDFs use business details from Edit profile instead of personal. */
  useBusinessForFinancials: boolean;
  paymentReminderDaysBeforeDue: number;
  overdueAlertsEnabled: boolean;
  monthlySummariesEnabled: boolean;
  newLeaseAlertsEnabled: boolean;
  leaseExpiringAlertsEnabled: boolean;
  lockInvoiceAfterSent: boolean;
  applicantFormTemplate: ApplicantFormTemplate;
};

export type UserSettingsPatch = Partial<UserSettings>;
