import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import { requireUserId } from "./profileSupabase";
import { getOrCreateUserSettings, upsertUserSettings } from "./settingsSupabase";

export type InvoiceAutomationSettings = {
  rentInvoiceDaysBeforeDue: number;
  rentInvoiceGracePeriodDays: number;
  autoGenerateInvoices: boolean;
  profileDaysBeforeDue: number | null;
  profileGracePeriodDays: number | null;
  platformDaysBeforeDue: number;
  platformGracePeriodDays: number;
};

export type GenerateDueLeaseInvoicesResult = {
  leasesChecked: number;
  invoicesCreated: number;
  skippedDuplicate: number;
  skippedInactive: number;
  skippedNotDue: number;
  skippedAutoDisabled?: number;
  errors: Array<{ leaseId?: string; propertyId?: string; message: string }>;
  asOfDate: string;
  timezone: string;
};

function toError(e: PostgrestError | Error): Error {
  if (e instanceof Error) return e;
  const pe = e as PostgrestError;
  const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Database request failed.");
}

function mapGenerateResult(raw: Record<string, unknown>): GenerateDueLeaseInvoicesResult {
  const errorsRaw = raw.errors;
  const errors = Array.isArray(errorsRaw)
    ? errorsRaw.map((e) => {
        const o = e as Record<string, unknown>;
        return {
          leaseId: o.lease_id != null ? String(o.lease_id) : o.leaseId != null ? String(o.leaseId) : undefined,
          propertyId:
            o.property_id != null ? String(o.property_id) : o.propertyId != null ? String(o.propertyId) : undefined,
          message: String(o.message ?? "Unknown error")
        };
      })
    : [];
  return {
    leasesChecked: Number(raw.leases_checked ?? raw.leasesChecked ?? 0),
    invoicesCreated: Number(raw.invoices_created ?? raw.invoicesCreated ?? 0),
    skippedDuplicate: Number(raw.skipped_duplicate ?? raw.skippedDuplicate ?? 0),
    skippedInactive: Number(raw.skipped_inactive ?? raw.skippedInactive ?? 0),
    skippedNotDue: Number(raw.skipped_not_due ?? raw.skippedNotDue ?? 0),
    skippedAutoDisabled: Number(raw.skipped_auto_disabled ?? raw.skippedAutoDisabled ?? 0),
    errors,
    asOfDate: String(raw.as_of_date ?? raw.asOfDate ?? ""),
    timezone: String(raw.timezone ?? "")
  };
}

/** Resolved settings: user_settings → profile override → platform default → fallback. */
export async function getInvoiceAutomationSettings(): Promise<InvoiceAutomationSettings> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const [userSettings, { data: profile, error: pErr }, { data: defaults, error: dErr }] = await Promise.all([
    getOrCreateUserSettings(),
    sb
      .from("profiles")
      .select("rent_invoice_days_before_due, rent_invoice_grace_period_days")
      .eq("id", uid)
      .maybeSingle(),
    sb
      .from("portfolio_projection_defaults")
      .select("rent_invoice_days_before_due, rent_invoice_grace_period_days")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);
  if (pErr) throw toError(pErr);
  if (dErr) throw toError(dErr);

  const platformDaysBeforeDue = Number(defaults?.rent_invoice_days_before_due ?? 10);
  const platformGracePeriodDays = Number(defaults?.rent_invoice_grace_period_days ?? 7);
  const profileDaysBeforeDue =
    profile?.rent_invoice_days_before_due != null ? Number(profile.rent_invoice_days_before_due) : null;
  const profileGracePeriodDays =
    profile?.rent_invoice_grace_period_days != null ? Number(profile.rent_invoice_grace_period_days) : null;

  return {
    rentInvoiceDaysBeforeDue: userSettings.invoiceGenerateDaysBeforeDue,
    rentInvoiceGracePeriodDays: profileGracePeriodDays ?? platformGracePeriodDays,
    autoGenerateInvoices: userSettings.autoGenerateInvoices,
    profileDaysBeforeDue,
    profileGracePeriodDays,
    platformDaysBeforeDue,
    platformGracePeriodDays
  };
}

export async function updateProfileInvoiceAutomationSettings(patch: {
  rentInvoiceDaysBeforeDue?: number;
  rentInvoiceGracePeriodDays?: number;
  autoGenerateInvoices?: boolean;
}): Promise<InvoiceAutomationSettings> {
  const settingsPatch: {
    invoiceGenerateDaysBeforeDue?: number;
    autoGenerateInvoices?: boolean;
  } = {};
  if (patch.rentInvoiceDaysBeforeDue != null) {
    settingsPatch.invoiceGenerateDaysBeforeDue = patch.rentInvoiceDaysBeforeDue;
  }
  if (patch.autoGenerateInvoices != null) {
    settingsPatch.autoGenerateInvoices = patch.autoGenerateInvoices;
  }
  if (Object.keys(settingsPatch).length > 0) {
    await upsertUserSettings(settingsPatch);
  }
  if (patch.rentInvoiceGracePeriodDays != null) {
    const sb = getSupabase();
    const { error } = await sb.rpc("update_profile_invoice_automation_settings", {
      p_payload: { rentInvoiceGracePeriodDays: patch.rentInvoiceGracePeriodDays }
    });
    if (error) throw toError(error);
  }
  return getInvoiceAutomationSettings();
}

export async function updatePlatformInvoiceAutomationDefaults(patch: {
  rentInvoiceDaysBeforeDue?: number;
  rentInvoiceGracePeriodDays?: number;
}): Promise<{ rentInvoiceDaysBeforeDue: number; rentInvoiceGracePeriodDays: number }> {
  await requireUserId();
  const sb = getSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.rentInvoiceDaysBeforeDue != null) {
    payload.rentInvoiceDaysBeforeDue = patch.rentInvoiceDaysBeforeDue;
  }
  if (patch.rentInvoiceGracePeriodDays != null) {
    payload.rentInvoiceGracePeriodDays = patch.rentInvoiceGracePeriodDays;
  }
  const { data, error } = await sb.rpc("update_platform_invoice_automation_defaults", { p_payload: payload });
  if (error) throw toError(error);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    rentInvoiceDaysBeforeDue: Number(row.rentInvoiceDaysBeforeDue ?? row.rent_invoice_days_before_due ?? 10),
    rentInvoiceGracePeriodDays: Number(row.rentInvoiceGracePeriodDays ?? row.rent_invoice_grace_period_days ?? 7)
  };
}

/** Idempotent rent invoice sync for signed-in landlord (own leases only). */
export async function generateDueLeaseInvoices(): Promise<GenerateDueLeaseInvoicesResult> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("generate_due_lease_invoices");
  if (error) throw toError(error);
  return mapGenerateResult((data ?? {}) as Record<string, unknown>);
}
