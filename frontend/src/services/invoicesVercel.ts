import { getSupabase } from "../lib/supabaseClient";
import { readVercelError } from "./vercelResponse";

export type GenerateInvoicePdfResponse = {
  message?: string;
  invoiceId: string;
  hasPdf?: boolean;
  /** True when an existing stored PDF was reused (no regeneration). */
  reused?: boolean;
  /** Draft preview — signed URL only, invoice row not updated. */
  ephemeral?: boolean;
  downloadUrl?: string;
  expiresIn?: number;
  storageKey?: string;
  storageBucket?: string;
  error?: string;
};

/**
 * Calls `POST /api/invoices/generate` (Vercel serverless) — same pattern as reports.
 * Requires a Supabase session access token.
 */
export type GenerateInvoicePdfOptions = {
  /** Regenerate even when a stored PDF exists (picks up latest banking / lease reference). */
  force?: boolean;
};

export async function generateInvoicePdfViaVercel(
  invoiceId: string,
  opts: GenerateInvoicePdfOptions = {}
): Promise<GenerateInvoicePdfResponse> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw sessionErr;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch("/api/invoices/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      invoiceId,
      ...(opts.force ? { force: true } : {})
    })
  });

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new Error(`${msg} (HTTP ${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as GenerateInvoicePdfResponse & { error?: string };
  if (!json.downloadUrl && json.error) throw new Error(json.error);
  return json;
}
