import { api, authHeader } from "./client";
import type { UiColorScheme } from "../theme/uiColorScheme";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { fetchProfileForUserId } from "./profileFromSupabase";

export type { UiColorScheme };

export type InvoicePaymentDetailsPayload = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  referenceNote?: string;
  extraLines?: string[];
};

/** Current user + profile row (Supabase Auth UUID). */
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

export async function fetchMe(): Promise<MeResponse> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not signed in.");

  const profile = await fetchProfileForUserId(user.id);

  return {
    id: user.id,
    email: user.email ?? "",
    name: (profile?.full_name as string | null | undefined) ?? null,
    role: profile?.role as string | undefined,
    invoicePaymentDetails: profile?.invoice_payment_details ?? null,
    uiColorScheme: profile?.ui_color_scheme === "light" ? "light" : "dark",
    freeUsesRemaining: profile?.free_uses_remaining ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at)
  };
}

export async function patchProfileInvoicePaymentDetails(
  invoicePaymentDetails: InvoicePaymentDetailsPayload
): Promise<{ invoicePaymentDetails: unknown }> {
  if (!isSupabaseConfigured) {
    const res = await api.patch<{ invoicePaymentDetails: unknown }>(
      "/user/profile",
      { invoicePaymentDetails },
      { headers: authHeader() }
    );
    return res.data;
  }
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not signed in.");

  const { error } = await sb
    .from("profiles")
    .update({ invoice_payment_details: invoicePaymentDetails as Record<string, unknown> })
    .eq("id", user.id);
  if (error) throw error;

  return { invoicePaymentDetails };
}

export async function patchProfileUiColorScheme(
  uiColorScheme: UiColorScheme
): Promise<{ uiColorScheme: UiColorScheme }> {
  if (!isSupabaseConfigured) {
    const res = await api.patch<{ uiColorScheme: UiColorScheme }>(
      "/user/profile",
      { uiColorScheme },
      { headers: authHeader() }
    );
    return res.data;
  }
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not signed in.");

  const { error } = await sb.from("profiles").update({ ui_color_scheme: uiColorScheme }).eq("id", user.id);
  if (error) throw error;

  return { uiColorScheme };
}
