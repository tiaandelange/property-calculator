import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest, isUuid } from "../supabaseServerAuth.js";
import { syncDueRentInvoicesForUserProperty } from "../syncDueRentInvoicesServer.js";

function readPropertyIdFromPath(req: VercelRequest): string | null {
  const raw = req.query.propertyId;
  if (raw == null) return null;
  const id = String(Array.isArray(raw) ? raw[0] : raw).trim();
  return id || null;
}

function readToday(req: VercelRequest): string | undefined {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const raw = (body as Record<string, unknown>).today;
  if (raw == null) return undefined;
  const today = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : undefined;
}

export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const propertyId = readPropertyIdFromPath(req);
  if (!propertyId || !isUuid(propertyId)) {
    res.status(400).json({ error: "Valid propertyId is required." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const summary = await syncDueRentInvoicesForUserProperty({
      sb: auth.ctx.sb,
      userId: auth.ctx.uid,
      propertyId,
      today: readToday(req)
    });
    res.status(200).json(summary);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Rent invoice sync failed.";
    console.error("[properties/sync-due-rent-invoices]", propertyId, msg);
    res.status(500).json({ error: msg });
  }
}
