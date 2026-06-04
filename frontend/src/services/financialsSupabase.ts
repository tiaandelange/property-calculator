import type { PostgrestError } from "@supabase/supabase-js";
import { requireUserIdFromSession } from "../lib/authSession";
import { getSupabase } from "../lib/supabaseClient";
import {
  buildExpenseInsert,
  buildExpenseUpdatePatch,
  buildIncomeInsert,
  buildIncomeUpdatePatch,
  dbToExpense,
  dbToIncome
} from "../api/financialRowMapping";
import { listRecurringIncomeRulesForProperty } from "./recurringRulesSupabase";
import { utcCalendarMonthBounds } from "../utils/financialMonthBounds";
import { leaseDisplayStatus } from "../utils/leaseDisplay";
import { derivePropertyOccupancy, effectiveActiveUnitCount, structureTypeIdFromProperty } from "../utils/propertyOccupancy";
import { getProperty } from "./propertiesSupabase";

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function requireUserId(): Promise<string> {
  try {
    return await requireUserIdFromSession();
  } catch (e) {
    throw toError(e instanceof Error ? e : new Error(String(e)));
  }
}

function sumByCategory<T extends { category?: string; amount?: number }>(rows: T[], category: string): number {
  return rows.filter((r) => r.category === category).reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
}

function inUtcMonthRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= start.getTime() && t < end.getTime();
}

/**
 * Calendar-month financial summary from ledger rows + property fields.
 * Mirrors `computeFinancialSummary` in Express except: no recurring-expense materialisation,
 * no paid-invoice income (invoices still on Express).
 */
export function buildFinancialSummaryFromLedger(
  property: Record<string, unknown>,
  incomeRows: Record<string, unknown>[],
  expenseRows: Record<string, unknown>[],
  calendarMonth?: string | null
): Record<string, unknown> | null {
  if (!property || typeof property !== "object") return null;

  const { start, end } = utcCalendarMonthBounds(calendarMonth ?? null, new Date());

  const activeExpenses = expenseRows.filter((e) => String(e.status ?? "") === "ACTIVE");
  const nonArchivedIncome = incomeRows.filter((i) => String(i.status ?? "") !== "ARCHIVED");

  const expensesMonth = activeExpenses.filter((e) => inUtcMonthRange(String(e.expenseDate ?? ""), start, end));
  const incomeMonthReceived = nonArchivedIncome.filter(
    (i) => String(i.status ?? "") === "RECEIVED" && inUtcMonthRange(String(i.incomeDate ?? ""), start, end)
  );
  const incomeMonthExpected = nonArchivedIncome.filter(
    (i) => String(i.status ?? "") === "EXPECTED" && inUtcMonthRange(String(i.incomeDate ?? ""), start, end)
  );
  const incomeAllReceived = nonArchivedIncome.filter((i) => String(i.status ?? "") === "RECEIVED");

  const invoiceIncomeMonth = 0;

  const totalRentIncome = sumByCategory(incomeMonthReceived, "RENT") + invoiceIncomeMonth;
  const totalIncome = incomeMonthReceived.reduce((a, b) => a + Number(b.amount ?? 0), 0) + invoiceIncomeMonth;
  const totalOtherIncome = totalIncome - totalRentIncome;
  const expectedIncome = incomeMonthExpected.reduce((a, b) => a + Number(b.amount ?? 0), 0);

  const totalRatesTaxes = sumByCategory(expensesMonth, "RATES_TAXES");
  const totalWater = sumByCategory(expensesMonth, "WATER");
  const totalElectricity = sumByCategory(expensesMonth, "ELECTRICITY");
  const totalLevies = sumByCategory(expensesMonth, "LEVIES");
  const totalInsurance = sumByCategory(expensesMonth, "INSURANCE");
  const totalMaintenance = sumByCategory(expensesMonth, "MAINTENANCE") + sumByCategory(expensesMonth, "REPAIRS");
  let totalBondPayment = sumByCategory(expensesMonth, "BOND_PAYMENT");
  let totalExpenses = expensesMonth.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const bondFromProfile = totalBondPayment <= 0 ? Number(property.monthlyBondPayment ?? 0) : 0;
  if (bondFromProfile > 0) {
    totalBondPayment = bondFromProfile;
    totalExpenses += bondFromProfile;
  }
  const totalOtherExpenses =
    totalExpenses -
    (totalRatesTaxes + totalWater + totalElectricity + totalLevies + totalInsurance + totalMaintenance + totalBondPayment);
  const netMonthlyCashFlow = totalIncome - totalExpenses;

  const annualIncome = incomeAllReceived.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const annualExpenses = activeExpenses.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const annualNetCashFlow = annualIncome - annualExpenses;
  const annualRent = incomeAllReceived.filter((i) => i.category === "RENT").reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const purchasePrice = Number(property.purchasePrice ?? 0);
  const grossYield = purchasePrice > 0 ? annualRent / purchasePrice : 0;
  const netYield = purchasePrice > 0 ? annualNetCashFlow / purchasePrice : 0;
  const outstandingLoanAmount = Number(property.outstandingBondBalance ?? 0);
  const currentEstimatedValue = property.currentEstimatedValue != null ? Number(property.currentEstimatedValue) : null;
  const estimatedEquity = currentEstimatedValue != null ? currentEstimatedValue - outstandingLoanAmount : null;

  const leases = (property.leases as Record<string, unknown>[] | undefined) ?? [];
  const activeLeases = leases.filter((l) =>
    ["ACTIVE", "MONTH_TO_MONTH"].includes(
      leaseDisplayStatus({
        status: String(l.status ?? ""),
        fixedTermEndDate: (l.fixedTermEndDate as string | Date | null | undefined) ?? null
      })
    )
  );
  const structureTypeId = structureTypeIdFromProperty(property);
  const totalUnitCount = effectiveActiveUnitCount(
    structureTypeId,
    Number(property.activeUnitCount ?? property.leasedUnitCount) || undefined
  );
  const occupancy = derivePropertyOccupancy({
    structureTypeId,
    investmentType: property.investmentType as string | undefined,
    activeLeaseCount: activeLeases.length,
    totalUnitCount
  });
  const occupancyStatus =
    occupancy.code === "PARTIALLY_OCCUPIED"
      ? "Partially rented"
      : occupancy.code === "OCCUPIED"
        ? "Occupied"
        : "Vacant";

  return {
    monthly: {
      totalRentIncome,
      totalOtherIncome,
      totalIncome,
      expectedIncome,
      totalRatesTaxes,
      totalWater,
      totalElectricity,
      totalLevies,
      totalInsurance,
      totalMaintenance,
      totalBondPayment,
      totalOtherExpenses,
      totalExpenses,
      netMonthlyCashFlow
    },
    annual: {
      annualIncome,
      annualExpenses,
      annualNetCashFlow
    },
    investorMetrics: {
      grossYield,
      netYield,
      estimatedEquity,
      occupancyStatus
    }
  };
}

export async function listIncome(
  propertyId: string | number,
  opts?: { includeArchived?: boolean }
): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  let q = sb.from("income_entries").select("*").eq("property_id", String(propertyId));
  if (!opts?.includeArchived) {
    q = q.neq("status", "ARCHIVED");
  }
  q = q.order("income_date", { ascending: false });
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data ?? []).map((r) => dbToIncome(r as Record<string, unknown>));
}

export async function listExpenses(
  propertyId: string | number,
  opts?: { includeArchived?: boolean }
): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  let q = sb.from("expense_entries").select("*").eq("property_id", String(propertyId));
  if (!opts?.includeArchived) {
    q = q.neq("status", "ARCHIVED");
  }
  q = q.order("expense_date", { ascending: false });
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data ?? []).map((r) => dbToExpense(r as Record<string, unknown>));
}

export async function createIncome(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const row = buildIncomeInsert(uid, String(propertyId), input);
  const { data, error } = await sb.from("income_entries").insert(row).select("*").single();
  if (error) throw toError(error);
  return dbToIncome(data as Record<string, unknown>);
}

export async function createExpense(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const row = buildExpenseInsert(uid, String(propertyId), input);
  const { data, error } = await sb.from("expense_entries").insert(row).select("*").single();
  if (error) throw toError(error);
  return dbToExpense(data as Record<string, unknown>);
}

export async function updateIncome(id: string | number, input: Record<string, unknown>): Promise<{ income: Record<string, unknown> }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: existing, error: readErr } = await sb
    .from("income_entries")
    .select("id,status")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (readErr) throw toError(readErr);
  if (!existing) throw new Error("Income not found");
  if (String((existing as { status?: string }).status) === "ARCHIVED") {
    throw new Error("Cannot edit an archived income entry.");
  }
  const patch = buildIncomeUpdatePatch(input);
  if (Object.keys(patch).length === 0) {
    const { data: row, error } = await sb.from("income_entries").select("*").eq("id", String(id)).eq("user_id", uid).single();
    if (error) throw toError(error);
    return { income: dbToIncome(row as Record<string, unknown>) };
  }
  const { data, error } = await sb
    .from("income_entries")
    .update(patch)
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return { income: dbToIncome(data as Record<string, unknown>) };
}

export async function updateExpense(id: string | number, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const patch = buildExpenseUpdatePatch(input);
  if (Object.keys(patch).length === 0) {
    const { data: row, error } = await sb.from("expense_entries").select("*").eq("id", String(id)).eq("user_id", uid).single();
    if (error) throw toError(error);
    return dbToExpense(row as Record<string, unknown>);
  }
  const { data, error } = await sb
    .from("expense_entries")
    .update(patch)
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbToExpense(data as Record<string, unknown>);
}

const archiveTs = () => new Date().toISOString();

export async function softDeleteIncome(id: string | number): Promise<{ message: string; income: Record<string, unknown> }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const ts = archiveTs();
  const { data, error } = await sb
    .from("income_entries")
    .update({ status: "ARCHIVED", archived_at: ts })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return { message: "Archived", income: dbToIncome(data as Record<string, unknown>) };
}

export async function softDeleteExpense(id: string | number): Promise<{ message: string; expense: Record<string, unknown> }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const ts = archiveTs();
  const { data, error } = await sb
    .from("expense_entries")
    .update({ status: "ARCHIVED", archived_at: ts })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return { message: "Archived", expense: dbToExpense(data as Record<string, unknown>) };
}

export async function hardDeleteIncome(id: string | number): Promise<{ message: string }> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("hard_delete_income_entry", { p_id: String(id) });
  if (error) throw toError(error);
  const msg = (data as { message?: string } | null)?.message;
  return { message: typeof msg === "string" && msg.trim() ? msg : "Deleted" };
}

export async function hardDeleteExpense(id: string | number): Promise<{ message: string; archived?: boolean }> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("hard_delete_expense_entry", { p_id: String(id) });
  if (error) throw toError(error);
  const o = (data ?? {}) as { message?: string; archived?: boolean };
  return {
    message: typeof o.message === "string" && o.message.trim() ? o.message : "Deleted",
    archived: o.archived === true
  };
}

export async function markIncomeReceived(
  id: string | number,
  body?: { paymentDate?: string | null }
): Promise<{ income: Record<string, unknown> }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: existing, error: readErr } = await sb
    .from("income_entries")
    .select("id,status")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (readErr) throw toError(readErr);
  if (!existing) throw new Error("Income not found");
  if (String((existing as { status?: string }).status) !== "EXPECTED") {
    throw new Error("Only EXPECTED income can be marked as received.");
  }
  const raw = body?.paymentDate;
  const paymentDate =
    raw != null && String(raw).trim() !== ""
      ? /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim())
        ? `${String(raw).trim()}T12:00:00.000Z`
        : new Date(String(raw)).toISOString()
      : new Date().toISOString();

  const { data, error } = await sb
    .from("income_entries")
    .update({ status: "RECEIVED", income_date: paymentDate })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return { income: dbToIncome(data as Record<string, unknown>) };
}

export { listRecurringIncomeRulesForProperty };

/** Same JSON envelope as `GET /api/properties/:propertyId/financials` (summary computed from Supabase ledger). */
export async function getPropertyFinancials(
  propertyId: string | number,
  opts?: { includeArchived?: boolean; calendarMonth?: string | null }
): Promise<{
  propertyId: string;
  summary: Record<string, unknown> | null;
  expenses: Record<string, unknown>[];
  income: Record<string, unknown>[];
  recurringIncomeRules: Record<string, unknown>[];
}> {
  const property = await getProperty(propertyId, {});
  const [income, expenses, recurringIncomeRules] = await Promise.all([
    listIncome(propertyId, { includeArchived: opts?.includeArchived }),
    listExpenses(propertyId, { includeArchived: opts?.includeArchived }),
    listRecurringIncomeRulesForProperty(propertyId)
  ]);
  const summary = buildFinancialSummaryFromLedger(property, income, expenses, opts?.calendarMonth ?? null);
  return {
    propertyId: String(propertyId),
    summary,
    expenses,
    income,
    recurringIncomeRules
  };
}
