import { readAuthSession } from "../lib/authSession";
import { readVercelError } from "./vercelResponse";

export type SendInvoiceEmailPayload = {
  invoiceId: string;
  to: string[];
  subject: string;
  message: string;
  copyMe?: boolean;
};

export async function sendInvoiceEmailViaVercel(
  payload: SendInvoiceEmailPayload
): Promise<{ message: string; providerEmailId?: string }> {
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw sessionErr;
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`/api/invoices/${encodeURIComponent(payload.invoiceId)}/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      message: payload.message,
      copyMe: payload.copyMe === true
    })
  });

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new Error(msg || `Send failed (HTTP ${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    providerEmailId?: string;
    error?: string;
  };
  return {
    message: json.message ?? "Invoice sent.",
    providerEmailId: json.providerEmailId
  };
}
