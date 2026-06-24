import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler as handleSyncDueRentInvoices } from "../../_lib/handlers/syncDueRentInvoices.js";

/** POST /api/properties/:id/sync-due-rent-invoices — explicit route (in addition to catch-all). */
export default function syncDueRentInvoices(req: VercelRequest, res: VercelResponse): Promise<void> {
  const propertyId = req.query.id;
  if (typeof propertyId === "string" && propertyId.trim()) {
    req.query.propertyId = propertyId.trim();
  }
  return handleSyncDueRentInvoices(req, res);
}
