import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  backfillBondStatementRows,
  loadOwnedProperty,
  postBondStatementRow,
  previewBondAtDate
} from "../bondLedgerServer.js";
import { authenticateSupabaseRequest, isUuid } from "../supabaseServerAuth.js";

type BondAction = "preview-at-date" | "statement-row" | "backfill-statement-rows";

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

function parseBondAction(req: VercelRequest): BondAction | null {
  const raw = String(req.query.action ?? "").trim();
  if (
    raw === "preview-at-date" ||
    raw === "statement-row" ||
    raw === "backfill-statement-rows"
  ) {
    return raw;
  }
  return null;
}

export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const propertyId = String(req.query.propertyId ?? "").trim();
  if (!isUuid(propertyId)) {
    res.status(400).json({ error: "Property id must be a UUID." });
    return;
  }

  const bondAction = parseBondAction(req);
  if (!bondAction) {
    res.status(404).json({ error: "Unknown bond action." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (bondAction === "preview-at-date") {
    if (req.method !== "GET") {
      res.status(405).setHeader("Allow", "GET").json({ error: "Method not allowed" });
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
    return;
  }

  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req);

  if (bondAction === "statement-row") {
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
    return;
  }

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
