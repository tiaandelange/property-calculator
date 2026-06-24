import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler as handleInvoicesSendEmail } from "../../_lib/handlers/invoicesSendEmail.js";

/** POST /api/invoices/:id/send-email */
export default function invoicesSendEmail(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = req.query.id;
  if (typeof id === "string" && id.trim()) {
    req.query.id = id.trim();
  }
  return handleInvoicesSendEmail(req, res);
}
