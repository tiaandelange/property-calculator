import { getSupabase } from "../lib/supabaseClient";
import { readVercelError } from "./vercelResponse";

export async function sendInvoiceEmailViaVercel(invoiceId: string): Promise<{ message: string }> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw sessionErr;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new Error(`${msg} (HTTP ${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return { message: json.message ?? "Sent." };
}
