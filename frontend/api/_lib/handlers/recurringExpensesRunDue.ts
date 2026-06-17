import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  materializeDueRecurringExpenses,
  materializeDueRecurringExpensesForUser
} from "../recurringExpenseMaterializeServer.js";
import { authenticateSupabaseRequest } from "../supabaseServerAuth.js";

function readPropertyId(req: VercelRequest): string | null {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).propertyId;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id || null;
}

export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const propertyId = readPropertyId(req);
    const createdCount = propertyId
      ? (await materializeDueRecurringExpenses(auth.ctx.sb, auth.ctx.uid, propertyId)).created
      : (await materializeDueRecurringExpensesForUser(auth.ctx.sb, auth.ctx.uid)).createdCount;
    res.status(200).json({
      message: "Recurring expense materialization complete.",
      createdCount
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Run-due failed.";
    console.error("[recurring-expenses/run-due]", msg);
    res.status(500).json({ error: msg });
  }
}
