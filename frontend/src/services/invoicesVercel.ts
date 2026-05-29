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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/pdf")) {
    const pdfBase64 = arrayBufferToBase64(await res.arrayBuffer());
    return {
      invoiceId: res.headers.get("X-Invoice-Id") ?? invoiceId,
      hasPdf: false,
      ephemeral: true,
      pdfBase64
    };
  }

  const json = (await res.json().catch(() => ({}))) as GenerateInvoicePdfResponse & { error?: string };
  if (!json.downloadUrl && !json.pdfBase64 && json.error) throw new Error(json.error);
  return json;
}
