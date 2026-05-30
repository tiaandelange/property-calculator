import type { PostgrestError } from "@supabase/supabase-js";
import {
  normalizeApplicantFormTemplate,
  validateApplicantFormTemplate
} from "../features/applicants/applicantFormTemplate";
import { DEFAULT_USER_SETTINGS } from "../features/settings/settingsDefaults";
import type { UserSettings, UserSettingsPatch } from "../features/settings/settingsTypes";
import { getSupabase } from "../lib/supabaseClient";
import { requireUserId } from "./profileSupabase";

type DbRow = {
  user_id: string;
  theme_preference: string;
  accent_color: string;
  density: string;
  default_currency: string;
  statement_default_filter: string;
  lease_default_term_months: number;
  default_rent_due_day: number;
  recurring_expense_default_category: string;
  auto_generate_invoices: boolean;
  invoice_generate_days_before_due: number;
  invoice_number_format: string;
  pdf_branding_enabled: boolean;
  payment_reminder_days_before_due: number;
  overdue_alerts_enabled: boolean;
  monthly_summaries_enabled: boolean;
  new_lease_alerts_enabled: boolean;
  lease_expiring_alerts_enabled: boolean;
  lock_invoice_after_sent: boolean;
  applicant_form_template: unknown;
};

function toError(e: PostgrestError | Error): Error {
  if (e instanceof Error) return e;
  const pe = e as PostgrestError;
  const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Database request failed.");
}

function mapRow(row: DbRow | null): UserSettings {
  if (!row) return { ...DEFAULT_USER_SETTINGS };
  return {
    themePreference:
      row.theme_preference === "light" || row.theme_preference === "dark" || row.theme_preference === "system"
        ? row.theme_preference
        : DEFAULT_USER_SETTINGS.themePreference,
    accentColor: (row.accent_color as UserSettings["accentColor"]) ?? DEFAULT_USER_SETTINGS.accentColor,
    density: row.density === "compact" ? "compact" : "comfortable",
    defaultCurrency: row.default_currency ?? DEFAULT_USER_SETTINGS.defaultCurrency,
    statementDefaultFilter:
      (row.statement_default_filter as UserSettings["statementDefaultFilter"]) ??
      DEFAULT_USER_SETTINGS.statementDefaultFilter,
    leaseDefaultTermMonths: Number(row.lease_default_term_months ?? DEFAULT_USER_SETTINGS.leaseDefaultTermMonths),
    defaultRentDueDay: Number(row.default_rent_due_day ?? DEFAULT_USER_SETTINGS.defaultRentDueDay),
    recurringExpenseDefaultCategory:
      row.recurring_expense_default_category ?? DEFAULT_USER_SETTINGS.recurringExpenseDefaultCategory,
    autoGenerateInvoices: row.auto_generate_invoices ?? DEFAULT_USER_SETTINGS.autoGenerateInvoices,
    invoiceGenerateDaysBeforeDue:
      Number(row.invoice_generate_days_before_due ?? DEFAULT_USER_SETTINGS.invoiceGenerateDaysBeforeDue),
    invoiceNumberFormat: row.invoice_number_format ?? DEFAULT_USER_SETTINGS.invoiceNumberFormat,
    pdfBrandingEnabled: row.pdf_branding_enabled ?? DEFAULT_USER_SETTINGS.pdfBrandingEnabled,
    paymentReminderDaysBeforeDue:
      Number(row.payment_reminder_days_before_due ?? DEFAULT_USER_SETTINGS.paymentReminderDaysBeforeDue),
    overdueAlertsEnabled: row.overdue_alerts_enabled ?? DEFAULT_USER_SETTINGS.overdueAlertsEnabled,
    monthlySummariesEnabled: row.monthly_summaries_enabled ?? DEFAULT_USER_SETTINGS.monthlySummariesEnabled,
    newLeaseAlertsEnabled: row.new_lease_alerts_enabled ?? DEFAULT_USER_SETTINGS.newLeaseAlertsEnabled,
    leaseExpiringAlertsEnabled: row.lease_expiring_alerts_enabled ?? DEFAULT_USER_SETTINGS.leaseExpiringAlertsEnabled,
    lockInvoiceAfterSent: row.lock_invoice_after_sent ?? DEFAULT_USER_SETTINGS.lockInvoiceAfterSent,
    applicantFormTemplate: normalizeApplicantFormTemplate(row.applicant_form_template)
  };
}

function patchToPayload(patch: UserSettingsPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.themePreference !== undefined) out.themePreference = patch.themePreference;
  if (patch.accentColor !== undefined) out.accentColor = patch.accentColor;
  if (patch.density !== undefined) out.density = patch.density;
  if (patch.defaultCurrency !== undefined) out.defaultCurrency = patch.defaultCurrency;
  if (patch.statementDefaultFilter !== undefined) out.statementDefaultFilter = patch.statementDefaultFilter;
  if (patch.leaseDefaultTermMonths !== undefined) out.leaseDefaultTermMonths = patch.leaseDefaultTermMonths;
  if (patch.defaultRentDueDay !== undefined) out.defaultRentDueDay = patch.defaultRentDueDay;
  if (patch.recurringExpenseDefaultCategory !== undefined) {
    out.recurringExpenseDefaultCategory = patch.recurringExpenseDefaultCategory;
  }
  if (patch.autoGenerateInvoices !== undefined) out.autoGenerateInvoices = patch.autoGenerateInvoices;
  if (patch.invoiceGenerateDaysBeforeDue !== undefined) {
    out.invoiceGenerateDaysBeforeDue = patch.invoiceGenerateDaysBeforeDue;
  }
  if (patch.invoiceNumberFormat !== undefined) out.invoiceNumberFormat = patch.invoiceNumberFormat;
  if (patch.pdfBrandingEnabled !== undefined) out.pdfBrandingEnabled = patch.pdfBrandingEnabled;
  if (patch.paymentReminderDaysBeforeDue !== undefined) {
    out.paymentReminderDaysBeforeDue = patch.paymentReminderDaysBeforeDue;
  }
  if (patch.overdueAlertsEnabled !== undefined) out.overdueAlertsEnabled = patch.overdueAlertsEnabled;
  if (patch.monthlySummariesEnabled !== undefined) out.monthlySummariesEnabled = patch.monthlySummariesEnabled;
  if (patch.newLeaseAlertsEnabled !== undefined) out.newLeaseAlertsEnabled = patch.newLeaseAlertsEnabled;
  if (patch.leaseExpiringAlertsEnabled !== undefined) out.leaseExpiringAlertsEnabled = patch.leaseExpiringAlertsEnabled;
  if (patch.lockInvoiceAfterSent !== undefined) out.lockInvoiceAfterSent = patch.lockInvoiceAfterSent;
  if (patch.applicantFormTemplate !== undefined) out.applicantFormTemplate = patch.applicantFormTemplate;
  return out;
}

export function validateUserSettings(settings: UserSettings): string | null {
  if (!["light", "dark", "system"].includes(settings.themePreference)) {
    return "Invalid theme preference.";
  }
  if (settings.invoiceGenerateDaysBeforeDue < 0 || settings.invoiceGenerateDaysBeforeDue > 31) {
    return "Invoice generation days must be between 0 and 31.";
  }
  if (settings.defaultRentDueDay < 1 || settings.defaultRentDueDay > 28) {
    return "Rent due day must be between 1 and 28.";
  }
  if (settings.leaseDefaultTermMonths <= 0) {
    return "Lease default term must be a positive number.";
  }
  if (settings.paymentReminderDaysBeforeDue < 0 || settings.paymentReminderDaysBeforeDue > 31) {
    return "Payment reminder days must be between 0 and 31.";
  }
  return validateApplicantFormTemplate(settings.applicantFormTemplate);
}

/** Load or create the signed-in user's settings row (RLS: own row only). */
export async function getOrCreateUserSettings(): Promise<UserSettings> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_or_create_user_settings");
  if (error) throw toError(error);
  return mapRow(data as DbRow | null);
}

/** Persist settings patch via SECURITY DEFINER RPC with validation. */
export async function upsertUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  await requireUserId();
  const sb = getSupabase();
  const payload = patchToPayload(patch);
  if (Object.keys(payload).length === 0) {
    return getOrCreateUserSettings();
  }
  const { data, error } = await sb.rpc("upsert_user_settings", { p_payload: payload });
  if (error) throw toError(error);
  return mapRow(data as DbRow | null);
}
