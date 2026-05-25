import { getSupabase } from "../lib/supabaseClient";

export type RunDueResult = {
  created_count?: number;
  createdCount?: number;
  skipped_duplicates?: number;
  skippedDuplicates?: number;
  skipped_schedule?: number;
  skipped_non_monthly_frequency?: number;
  invoice_ids?: string[];
  income_entry_ids?: string[];
  message?: string;
  note?: string;
  [key: string]: unknown;
};

function toError(e: { message?: string; hint?: string; details?: string }): Error {
  const parts = [e.message, e.hint, e.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Run-due failed.");
}

/** Idempotent expected rent rows for active MONTHLY rules (RPC `run_due_recurring_income`). */
export async function runDueRecurringIncome(): Promise<RunDueResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("run_due_recurring_income");
  if (error) throw toError(error);
  return (data ?? {}) as RunDueResult;
}

/** Draft invoices for due MONTHLY recurring invoice rules (RPC `run_due_recurring_invoices`). */
export async function runDueRecurringInvoices(): Promise<RunDueResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("run_due_recurring_invoices");
  if (error) throw toError(error);
  return (data ?? {}) as RunDueResult;
}

/**
 * Recurring expense materialisation (bond splits). SQL stub returns zero;
 * use Vercel `POST /api/recurring-expenses/run-due` when Supabase is configured.
 */
export async function runDueRecurringExpensesViaRpc(): Promise<RunDueResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("run_due_recurring_expenses");
  if (error) throw toError(error);
  return (data ?? {}) as RunDueResult;
}
