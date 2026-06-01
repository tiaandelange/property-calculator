import type { PostgrestError } from "@supabase/supabase-js";
import type { UiColorScheme } from "../theme/uiColorScheme";
import {
  financialDisplayNameFromProfile,
  normalizeBusinessDetails,
  normalizeProfileDetails,
  resolveFinancialLandlordParty,
  type FinancialLandlordParty,
  type NormalizedBusinessDetails,
  type NormalizedProfileDetails
} from "../../api/lib/profileContactShared";
import { getSupabase } from "../lib/supabaseClient";

export const PROFILE_AVATARS_BUCKET = "avatars";

/** Columns read from `public.profiles` for the SPA shell. */
export const PROFILE_SELECT_FOR_APP =
  "full_name, role, invoice_payment_details, profile_details, business_details, ui_color_scheme, free_uses_remaining" as const;

export type ProfileForApp = {
  full_name: string | null;
  role: string | null;
  invoice_payment_details: unknown;
  profile_details: unknown;
  business_details: unknown;
  ui_color_scheme: string | null;
  free_uses_remaining: number | null;
};

export type { NormalizedProfileDetails, NormalizedBusinessDetails, FinancialLandlordParty };

export type InvoicePaymentDetailsPayload = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  referenceNote?: string;
  extraLines?: string[];
  /** CC address when invoice emails are sent (defaults to account login email). */
  ccEmail?: string;
  /** Optional default invoice email subject ({propertyName}, {invoiceNumber}, …). */
  defaultInvoiceEmailSubject?: string;
  /** Optional default invoice email body ({tenantFirstName}, {formattedTotalAmount}, …). */
  defaultInvoiceEmailBody?: string;
};

export type MeResponse = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  invoicePaymentDetails?: unknown;
  profileDetails?: NormalizedProfileDetails;
  businessDetails?: NormalizedBusinessDetails;
  /** Signed URL for avatar preview when avatarStorageKey is set. */
  avatarUrl?: string | null;
  useBusinessForFinancials?: boolean;
  financialLandlord?: FinancialLandlordParty;
  uiColorScheme?: UiColorScheme;
  freeUsesRemaining?: number | null;
  emailConfirmed?: boolean;
};

export type ProfileUpdateInput = {
  fullName?: string | null;
  uiColorScheme?: UiColorScheme;
  invoicePaymentDetails?: InvoicePaymentDetailsPayload | Record<string, unknown> | null;
  profileDetails?: Record<string, unknown> | null;
  businessDetails?: Record<string, unknown> | null;
};

export type SavedUserReportRow = {
  id: string;
  type: string;
  created_at: string;
  hasPdf: boolean;
  reportId: string | null;
  downloadUrl: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
};

function toError(e: PostgrestError | Error): Error {
  if (e instanceof Error) return e;
  const pe = e as PostgrestError;
  const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Database request failed.");
}

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
}

export async function signedProfileAvatarUrl(storageKey: string | null | undefined): Promise<string | null> {
  const key = storageKey?.trim();
  if (!key) return null;
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(PROFILE_AVATARS_BUCKET).createSignedUrl(key, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Loads `public.profiles` for a user id (RLS: own row only). */
export async function fetchProfileForUserId(userId: string): Promise<ProfileForApp | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_SELECT_FOR_APP)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw toError(error);
  return data as ProfileForApp | null;
}

/** Current user + profile row (Supabase Auth session). */
export async function getCurrentProfile(): Promise<MeResponse> {
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) throw toError(userErr);
  const user = userData.user;
  if (!user) throw new Error("Not signed in.");

  const profile = await fetchProfileForUserId(user.id);
  const profileDetails = normalizeProfileDetails(profile?.profile_details);
  const businessDetails = normalizeBusinessDetails(
    profile?.business_details,
    profile?.invoice_payment_details
  );
  const avatarUrl = await signedProfileAvatarUrl(profileDetails.avatarStorageKey);

  const { data: settingsRow } = await sb
    .from("user_settings")
    .select("use_business_for_financials")
    .eq("user_id", user.id)
    .maybeSingle();

  const useBusinessForFinancials = settingsRow?.use_business_for_financials === true;
  const ccEmail = String(
    (profile?.invoice_payment_details as Record<string, unknown> | null)?.ccEmail ??
      (profile?.invoice_payment_details as Record<string, unknown> | null)?.cc_email ??
      ""
  ).trim();

  const financialLandlord = resolveFinancialLandlordParty({
    useBusinessForFinancials,
    fullName: profile?.full_name,
    authEmail: user.email,
    profileDetails,
    businessDetails,
    invoiceCcEmail: ccEmail
  });

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? null,
    role: profile?.role ?? undefined,
    invoicePaymentDetails: profile?.invoice_payment_details ?? null,
    profileDetails,
    businessDetails,
    avatarUrl,
    useBusinessForFinancials,
    financialLandlord,
    uiColorScheme: profile?.ui_color_scheme === "light" ? "light" : "dark",
    freeUsesRemaining: profile?.free_uses_remaining ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at)
  };
}

export function meFinancialDisplayName(me: MeResponse): string {
  return financialDisplayNameFromProfile({
    name: me.name,
    email: me.email,
    financialLandlord: me.financialLandlord
  });
}

/**
 * Updates allowed profile fields only. Never sends role, subscription_status, or free_uses_remaining.
 * Invoice payment details use RPC `update_invoice_payment_details`.
 */
export async function uploadProfileAvatar(file: File): Promise<string> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${uid}/avatar.${ext}`;
  const { error } = await sb.storage.from(PROFILE_AVATARS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${ext}`
  });
  if (error) throw toError(error);
  return path;
}

export async function updateProfileDetails(input: {
  fullName?: string | null;
  profileDetails?: Record<string, unknown> | null;
  businessDetails?: Record<string, unknown> | null;
}): Promise<{
  fullName?: string | null;
  profileDetails?: unknown;
  businessDetails?: unknown;
}> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("update_profile_details", {
    p_full_name: input.fullName ?? null,
    p_profile_details: input.profileDetails ?? null,
    p_business_details: input.businessDetails ?? null
  });
  if (error) throw toError(error);
  const payload = (data ?? {}) as {
    fullName?: string | null;
    profileDetails?: unknown;
    businessDetails?: unknown;
  };
  return {
    fullName: payload.fullName,
    profileDetails: payload.profileDetails,
    businessDetails: payload.businessDetails
  };
}

export async function updateProfile(input: ProfileUpdateInput): Promise<{
  fullName?: string | null;
  uiColorScheme?: UiColorScheme;
  invoicePaymentDetails?: unknown;
  profileDetails?: unknown;
  businessDetails?: unknown;
}> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const out: {
    fullName?: string | null;
    uiColorScheme?: UiColorScheme;
    invoicePaymentDetails?: unknown;
    profileDetails?: unknown;
    businessDetails?: unknown;
  } = {};

  if (
    input.fullName !== undefined ||
    input.profileDetails !== undefined ||
    input.businessDetails !== undefined
  ) {
    const contact = await updateProfileDetails({
      fullName: input.fullName,
      profileDetails: input.profileDetails ?? undefined,
      businessDetails: input.businessDetails ?? undefined
    });
    if (contact.fullName !== undefined) out.fullName = contact.fullName;
    if (contact.profileDetails !== undefined) out.profileDetails = contact.profileDetails;
    if (contact.businessDetails !== undefined) out.businessDetails = contact.businessDetails;
  }

  if (input.invoicePaymentDetails !== undefined) {
    const { data, error } = await sb.rpc("update_invoice_payment_details", {
      p_details: input.invoicePaymentDetails
    });
    if (error) throw toError(error);
    const payload = (data ?? {}) as { invoicePaymentDetails?: unknown };
    out.invoicePaymentDetails = payload.invoicePaymentDetails ?? input.invoicePaymentDetails;
  }

  const patch: Record<string, unknown> = {};
  if (input.uiColorScheme !== undefined) patch.ui_color_scheme = input.uiColorScheme;

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error } = await sb.from("profiles").update(patch).eq("id", uid);
    if (error) throw toError(error);
    if (input.uiColorScheme !== undefined) out.uiColorScheme = input.uiColorScheme;
  }

  return out;
}

/** Saved calculator runs for the signed-in user (`calculator_results` + latest `stored_reports` PDF). */
export async function listUserReports(): Promise<SavedUserReportRow[]> {
  const sb = getSupabase();
  const uid = await requireUserId();

  const { data: calcs, error: e1 } = await sb
    .from("calculator_results")
    .select("id,type,created_at,input_json,result_json")
    .order("created_at", { ascending: false });

  if (e1) throw toError(e1);

  const rows = (calcs ?? []) as Array<{
    id: string;
    type: string;
    created_at: string;
    input_json: unknown;
    result_json: unknown;
  }>;

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const { data: reports, error: e2 } = await sb
    .from("stored_reports")
    .select("id,calculation_id,file_name,created_at,storage_bucket,storage_key")
    .eq("user_id", uid)
    .in("calculation_id", ids)
    .order("created_at", { ascending: false });

  if (e2) throw toError(e2);

  const latestPdf = new Map<
    string,
    { id: string; storage_bucket: string | null; storage_key: string | null }
  >();
  for (const s of reports ?? []) {
    const cid = s.calculation_id as string | null;
    if (cid && !latestPdf.has(cid)) {
      latestPdf.set(cid, {
        id: String(s.id),
        storage_bucket: (s.storage_bucket as string | null) ?? null,
        storage_key: (s.storage_key as string | null) ?? null
      });
    }
  }

  return Promise.all(
    rows.map(async (r) => {
      const pdf = latestPdf.get(r.id);
      let downloadUrl: string | null = null;
      const hasStoragePdf = Boolean(pdf?.storage_bucket && pdf.storage_key);
      if (hasStoragePdf && pdf) {
        const { data: signed, error: signErr } = await sb.storage
          .from(pdf.storage_bucket!)
          .createSignedUrl(pdf.storage_key!, 600);
        if (!signErr && signed?.signedUrl) downloadUrl = signed.signedUrl;
      }
      return {
        id: r.id,
        type: r.type,
        created_at: r.created_at,
        hasPdf: hasStoragePdf,
        legacyPdfOnly: Boolean(pdf && !hasStoragePdf),
        reportId: pdf?.id ?? null,
        downloadUrl,
        input: asObject(r.input_json),
        result: asObject(r.result_json)
      };
    })
  );
}

/** Deletes a saved calculation, its stored report rows, and Storage PDF objects when present. */
export async function deleteUserReport(id: string): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: stored, error: selErr } = await sb
    .from("stored_reports")
    .select("id, storage_bucket, storage_key")
    .eq("calculation_id", id)
    .eq("user_id", uid);

  if (selErr) throw toError(selErr);

  for (const row of stored ?? []) {
    const bucket = row.storage_bucket as string | null;
    const key = row.storage_key as string | null;
    if (bucket && key) {
      await sb.storage.from(bucket).remove([key]);
    }
  }

  const { error: delReportsErr } = await sb
    .from("stored_reports")
    .delete()
    .eq("calculation_id", id)
    .eq("user_id", uid);
  if (delReportsErr) throw toError(delReportsErr);

  const { error: delCalcErr } = await sb.from("calculator_results").delete().eq("id", id).eq("user_id", uid);
  if (delCalcErr) throw toError(delCalcErr);
}
