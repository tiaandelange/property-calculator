import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resendEmailDeliveryConfigured } from "../invoiceEmail.js";
import { processInvoiceSendEmail, type InvoiceSendEmailBody } from "../invoiceSendEmailServer.js";
import { authenticateSupabaseRequest, isUuid } from "../supabaseServerAuth.js";

function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body;
  if (b == null) return {};
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  return {};
}

export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const invoiceId = String(req.query.id ?? "").trim();
  if (!isUuid(invoiceId)) {
    res.status(400).json({ error: "Invoice id must be a UUID." });
    return;
  }

  if (!resendEmailDeliveryConfigured()) {
    res.status(503).json({ error: "Email delivery is not configured on the server (RESEND_API_KEY missing)." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const bodyRaw = parseJsonBody(req);
  const payload: InvoiceSendEmailBody = {
    to: Array.isArray(bodyRaw.to) ? (bodyRaw.to as unknown[]).map((x) => String(x)) : [],
    subject: String(bodyRaw.subject ?? ""),
    message: String(bodyRaw.message ?? ""),
    copyMe: bodyRaw.copyMe === true || bodyRaw.copyMe === 1 || String(bodyRaw.copyMe ?? "") === "true"
  };

  try {
    const result = await processInvoiceSendEmail(auth.ctx.sb, auth.ctx.user, auth.ctx.uid, invoiceId, payload);

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      providerEmailId: result.providerEmailId
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Send email failed.";
    console.error("[send-email]", msg, e);
    res.status(500).json({ error: msg });
  }
}
