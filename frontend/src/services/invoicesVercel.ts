import { readAuthSession } from "../lib/authSession";
import { ApiRequestError } from "../lib/queryErrors";
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
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw new ApiRequestError(sessionErr.message, { status: 401, code: sessionErr.name });
  const token = session?.access_token;
  if (!token) throw new ApiRequestError("Not signed in.", { status: 401 });

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
    throw new ApiRequestError(msg, { status: res.status });
  }

  const json = (await res.json().catch(() => ({}))) as GenerateInvoicePdfResponse & { error?: string };
  if (!json.downloadUrl && json.error) throw new ApiRequestError(json.error);
  return json;
}
