import { getSupabase } from "../lib/supabaseClient";
import { readVercelError } from "./vercelResponse";

export type GenerateInvoicePdfResponse = {
  message?: string;
  invoiceId: string;
  hasPdf?: boolean;
  /** True when an existing stored PDF was reused (no regeneration). */
  reused?: boolean;
  /** Draft preview — PDF bytes only, not stored in Supabase Storage. */
  ephemeral?: boolean;
  pdfBase64?: string;
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

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new Error(`${msg} (HTTP ${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as GenerateInvoicePdfResponse & { error?: string };
  if (!json.downloadUrl && !json.pdfBase64 && json.error) throw new Error(json.error);
  return json;
}
