import type { PostgrestError } from "@supabase/supabase-js";
import type { UiColorScheme } from "../theme/uiColorScheme";
import { getSupabase } from "../lib/supabaseClient";

/** Columns read from `public.profiles` for the SPA shell. */
export const PROFILE_SELECT_FOR_APP =
  "full_name, role, invoice_payment_details, ui_color_scheme, free_uses_remaining" as const;

export type ProfileForApp = {
  full_name: string | null;
  role: string | null;
  invoice_payment_details: unknown;
  ui_color_scheme: string | null;
  free_uses_remaining: number | null;
};

export type InvoicePaymentDetailsPayload = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  referenceNote?: string;
  extraLines?: string[];
};

export type MeResponse = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  invoicePaymentDetails?: unknown;
  uiColorScheme?: UiColorScheme;
  freeUsesRemaining?: number | null;
  emailConfirmed?: boolean;
};

export type ProfileUpdateInput = {
  fullName?: string | null;
  uiColorScheme?: UiColorScheme;
  invoicePaymentDetails?: InvoicePaymentDetailsPayload | Record<string, unknown> | null;
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

async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
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

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? null,
    role: profile?.role ?? undefined,
    invoicePaymentDetails: profile?.invoice_payment_details ?? null,
    uiColorScheme: profile?.ui_color_scheme === "light" ? "light" : "dark",
    freeUsesRemaining: profile?.free_uses_remaining ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at)
  };
}

/**
 * Updates allowed profile fields only. Never sends role, subscription_status, or free_uses_remaining.
 * Invoice payment details use RPC `update_invoice_payment_details`.
 */
export async function updateProfile(input: ProfileUpdateInput): Promise<{
  fullName?: string | null;
  uiColorScheme?: UiColorScheme;
  invoicePaymentDetails?: unknown;
}> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const out: {
    fullName?: string | null;
    uiColorScheme?: UiColorScheme;
    invoicePaymentDetails?: unknown;
  } = {};

  if (input.invoicePaymentDetails !== undefined) {
    const { data, error } = await sb.rpc("update_invoice_payment_details", {
      p_details: input.invoicePaymentDetails
    });
    if (error) throw toError(error);
    const payload = (data ?? {}) as { invoicePaymentDetails?: unknown };
    out.invoicePaymentDetails = payload.invoicePaymentDetails ?? input.invoicePaymentDetails;
  }

  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.uiColorScheme !== undefined) patch.ui_color_scheme = input.uiColorScheme;

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error } = await sb.from("profiles").update(patch).eq("id", uid);
    if (error) throw toError(error);
    if (input.fullName !== undefined) out.fullName = input.fullName;
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
      if (pdf?.storage_bucket && pdf.storage_key) {
        const { data: signed, error: signErr } = await sb.storage
          .from(pdf.storage_bucket)
          .createSignedUrl(pdf.storage_key, 600);
        if (!signErr && signed?.signedUrl) downloadUrl = signed.signedUrl;
      } else if (pdf) {
        downloadUrl = `/api/reports/${pdf.id}/download`;
      }
      return {
        id: r.id,
        type: r.type,
        created_at: r.created_at,
        hasPdf: Boolean(pdf),
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
