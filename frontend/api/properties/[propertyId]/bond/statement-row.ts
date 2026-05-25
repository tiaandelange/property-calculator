import type { VercelRequest, VercelResponse } from "@vercel/node";
import { postBondStatementRow } from "../../../lib/bondLedgerServer";
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
  const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : "";

  try {
    const result = await postBondStatementRow(auth.ctx.sb, auth.ctx.uid, propertyId, dueDate);
    if (!result.ok) {
      const payload: Record<string, unknown> = { error: result.message, message: result.message };
      if ("duplicateExpenseId" in result && result.duplicateExpenseId != null) {
        payload.duplicateExpenseId = result.duplicateExpenseId;
      }
      res.status(result.status).json(payload);
      return;
    }
    res.status(201).json({ expense: result.expense });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not add bond payment.";
    console.error("[bond/statement-row]", msg);
    res.status(500).json({ error: msg });
  }
}
