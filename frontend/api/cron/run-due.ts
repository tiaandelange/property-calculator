import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createServiceRoleSupabase,
  cronSecretFromRequest,
  verifyCronSecret
} from "../lib/supabaseServiceRole";

/**
 * Protected cron entry: `Authorization: Bearer <CRON_SECRET>`.
 * Runs recurring income + invoice RPCs with service_role (all users).
 * Expense materialisation still requires `POST /api/recurring-expenses/run-due` (bond-aware TS).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).setHeader("Allow", "GET, POST").json({ error: "Method not allowed" });
    return;
  }

  const secret = cronSecretFromRequest(req.headers.authorization);
  if (!verifyCronSecret(secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sb = createServiceRoleSupabase();
  if (!sb) {
    res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
    return;
  }

  try {
    const [incomeRes, invoiceRes, expenseRes, leaseInvoicesRes] = await Promise.all([
      sb.rpc("run_due_recurring_income"),
      sb.rpc("run_due_recurring_invoices"),
      sb.rpc("run_due_recurring_expenses"),
      sb.rpc("generate_due_lease_invoices")
    ]);

    if (incomeRes.error) {
      res.status(500).json({ error: incomeRes.error.message, step: "income" });
      return;
    }
    if (invoiceRes.error) {
      res.status(500).json({ error: invoiceRes.error.message, step: "invoices" });
      return;
    }
    if (expenseRes.error) {
      res.status(500).json({ error: expenseRes.error.message, step: "expenses" });
      return;
    }
    if (leaseInvoicesRes.error) {
      res.status(500).json({ error: leaseInvoicesRes.error.message, step: "lease_invoices" });
      return;
    }

    res.status(200).json({
      ok: true,
      income: incomeRes.data,
      invoices: invoiceRes.data,
      expenses: expenseRes.data,
      leaseInvoices: leaseInvoicesRes.data
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron run-due failed.";
    console.error("[cron/run-due]", msg);
    res.status(500).json({ error: msg });
  }
}
