import { getSupabase } from "../lib/supabaseClient";

export type GenerateInvoicePdfResponse = {
  message?: string;
  invoiceId: string;
  hasPdf?: boolean;
  downloadUrl?: string;
  expiresIn?: number;
  storageKey?: string;
  storageBucket?: string;
  error?: string;
};

/**
 * Calls `POST /api/invoices/:id/generate-pdf` (Vercel serverless).
 * Requires a Supabase session access token.
 */
export async function generateInvoicePdfViaVercel(invoiceId: string): Promise<GenerateInvoicePdfResponse> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw sessionErr;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/generate-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const json = (await res.json().catch(() => ({}))) as GenerateInvoicePdfResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Invoice PDF generation failed (${res.status}).`);
  }
  if (!json.downloadUrl && json.error) {
    throw new Error(json.error);
  }
  return json;
}
