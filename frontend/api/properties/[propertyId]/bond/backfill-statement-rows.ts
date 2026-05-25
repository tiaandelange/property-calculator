import type { VercelRequest, VercelResponse } from "@vercel/node";
import { backfillBondStatementRows } from "../../../lib/bondLedgerServer";
import { authenticateSupabaseRequest, isUuid } from "../../../lib/supabaseServerAuth";

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
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

  const body = parseJsonBody(req);
  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const endDate = typeof body.endDate === "string" ? body.endDate.trim() : "";

  try {
    const result = await backfillBondStatementRows(auth.ctx.sb, auth.ctx.uid, propertyId, startDate, endDate);
    if (!result.ok) {
      res.status(result.status).json({ error: result.message, message: result.message });
      return;
    }
    res.status(201).json({
      createdCount: result.createdCount,
      createdIds: result.createdIds,
      skipped: result.skipped
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not backfill bond payments.";
    console.error("[bond/backfill-statement-rows]", msg);
    res.status(500).json({ error: msg });
  }
}
