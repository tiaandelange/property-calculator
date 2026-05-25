import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadOwnedProperty, previewBondAtDate } from "../../../lib/bondLedgerServer";
import { authenticateSupabaseRequest, isUuid } from "../../../lib/supabaseServerAuth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).setHeader("Allow", "GET").json({ error: "Method not allowed" });
    return;
  }

  const propertyId = String(req.query.propertyId ?? "").trim();
  if (!isUuid(propertyId)) {
    res.status(400).json({ error: "Property id must be a UUID." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const raw = typeof req.query.dueDate === "string" ? req.query.dueDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    res.status(400).json({ error: "Query parameter dueDate must be YYYY-MM-DD" });
    return;
  }

  try {
    const property = await loadOwnedProperty(auth.ctx.sb, auth.ctx.uid, propertyId);
    if (!property) {
      res.status(404).json({ error: "Property not found." });
      return;
    }
    const out = await previewBondAtDate(property, raw);
    res.status(200).json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not preview bond payment.";
    console.error("[bond/preview-at-date]", msg);
    res.status(500).json({ error: msg });
  }
}
