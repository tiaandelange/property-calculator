import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendInvoiceEmail } from "../../lib/invoiceEmail";
import { authenticateSupabaseRequest, isUuid } from "../../lib/supabaseServerAuth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const invoiceId = String(req.query.id ?? "").trim();
  if (!isUuid(invoiceId)) {
    res.status(400).json({ error: "Invoice id must be a UUID." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { sb, uid } = auth.ctx;

  try {
    const { data: invoice, error: invErr } = await sb
      .from("invoices")
      .select("id, user_id, invoice_number, total, status, tenants ( email )")
      .eq("id", invoiceId)
      .eq("user_id", uid)
      .maybeSingle();

    if (invErr || !invoice) {
      res.status(404).json({ error: "Invoice not found." });
      return;
    }

    const tenant = invoice.tenants as { email?: string | null } | null;
    const email = tenant?.email?.trim();
    if (!email) {
      res.status(400).json({ error: "Tenant email is missing." });
      return;
    }

    const sent = await sendInvoiceEmail({
      to: email,
      subject: `Invoice ${invoice.invoice_number}`,
      text: `Invoice ${invoice.invoice_number} total ${Number(invoice.total).toFixed(2)}`
    });

    if (!sent.ok) {
      res.status(400).json({ error: sent.message });
      return;
    }

    const { error: updErr } = await sb
      .from("invoices")
      .update({ status: "SENT", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("user_id", uid);

    if (updErr) {
      res.status(500).json({ error: updErr.message });
      return;
    }

    res.status(200).json({ message: sent.message });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Send email failed.";
    console.error("[send-email]", msg);
    res.status(500).json({ error: msg });
  }
}
