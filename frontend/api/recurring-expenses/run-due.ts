import type { VercelRequest, VercelResponse } from "@vercel/node";
import { materializeDueRecurringExpensesForUser } from "../lib/recurringExpenseMaterializeServer.js";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
    const { createdCount } = await materializeDueRecurringExpensesForUser(auth.ctx.sb, auth.ctx.uid);
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
