import { getSupabase } from "../lib/supabaseClient";

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

  const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? json.message ?? `Send email failed (${res.status}).`);
  }
  return { message: json.message ?? "Sent." };
}
