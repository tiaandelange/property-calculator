import type { UiColorScheme } from "../theme/uiColorScheme";
import { assertSupabaseConfigured } from "../lib/supabaseClient";
import {
  getCurrentProfile,
  updateProfile,
  type InvoicePaymentDetailsPayload,
  type MeResponse
} from "../services/profileSupabase";

export type { UiColorScheme, InvoicePaymentDetailsPayload, MeResponse };

export async function fetchMe(): Promise<MeResponse> {
  assertSupabaseConfigured();
  return getCurrentProfile();
}

export async function patchProfileInvoicePaymentDetails(
  invoicePaymentDetails: InvoicePaymentDetailsPayload
): Promise<{ invoicePaymentDetails: unknown }> {
  assertSupabaseConfigured();
  const updated = await updateProfile({ invoicePaymentDetails });
  return { invoicePaymentDetails: updated.invoicePaymentDetails ?? invoicePaymentDetails };
}

export async function patchProfileUiColorScheme(
  uiColorScheme: UiColorScheme
): Promise<{ uiColorScheme: UiColorScheme }> {
  assertSupabaseConfigured();
  await updateProfile({ uiColorScheme });
  return { uiColorScheme };
}
