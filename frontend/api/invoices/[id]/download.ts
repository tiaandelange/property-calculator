import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler as handleInvoicesDownload } from "../../_lib/handlers/invoicesDownload.js";

/** GET /api/invoices/:id/download */
export default function invoicesDownload(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = req.query.id;
  if (typeof id === "string" && id.trim()) {
    req.query.id = id.trim();
  }
  return handleInvoicesDownload(req, res);
}
