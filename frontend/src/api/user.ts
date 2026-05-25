import { api, authHeader } from "./client";
import type { UiColorScheme } from "../theme/uiColorScheme";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import {
  getCurrentProfile,
  updateProfile,
  type InvoicePaymentDetailsPayload,
  type MeResponse
} from "../services/profileSupabase";

export type { UiColorScheme, InvoicePaymentDetailsPayload, MeResponse };

/** @deprecated Prefer `getCurrentProfile()` from `profileSupabase`. */
export async function fetchMe(): Promise<MeResponse> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return getCurrentProfile();
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
  const updated = await updateProfile({ invoicePaymentDetails });
  return { invoicePaymentDetails: updated.invoicePaymentDetails ?? invoicePaymentDetails };
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
  await updateProfile({ uiColorScheme });
  return { uiColorScheme };
}
