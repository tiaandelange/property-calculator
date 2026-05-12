import { api, authHeader } from "./client";
import type { UiColorScheme } from "../theme/uiColorScheme";

export type { UiColorScheme };

export type InvoicePaymentDetailsPayload = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  referenceNote?: string;
  extraLines?: string[];
};

export type MeResponse = {
  id: number;
  email: string;
  name?: string | null;
  role?: string;
  invoicePaymentDetails?: unknown;
  uiColorScheme?: UiColorScheme;
};

export async function fetchMe(): Promise<MeResponse> {
  const res = await api.get<MeResponse>("/auth/me", { headers: authHeader() });
  return res.data;
}

export async function patchProfileInvoicePaymentDetails(
  invoicePaymentDetails: InvoicePaymentDetailsPayload
): Promise<{ invoicePaymentDetails: unknown }> {
  const res = await api.patch<{ invoicePaymentDetails: unknown }>(
    "/user/profile",
    { invoicePaymentDetails },
    { headers: authHeader() }
  );
  return res.data;
}

export async function patchProfileUiColorScheme(
  uiColorScheme: UiColorScheme
): Promise<{ uiColorScheme: UiColorScheme }> {
  const res = await api.patch<{ uiColorScheme: UiColorScheme }>(
    "/user/profile",
    { uiColorScheme },
    { headers: authHeader() }
  );
  return res.data;
}
