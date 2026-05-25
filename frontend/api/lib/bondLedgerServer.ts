import type { SupabaseClient } from "@supabase/supabase-js";
import { computePropertyBondFinance } from "./bondHelpers";
import {
  enumerateBondDueYmdsInRange,
  expenseDateFromYmd,
  isValidYmd,
  utcMonthBoundsForDueYmd
} from "./bondYmd";

export type PropertyBondRow = {
  outstandingBondBalance?: number | null;
  monthlyBondPayment?: number | null;
  bondAnnualInterestRatePercent?: number | null;
  bondTermYears?: number | null;
  bondStartDate?: string | null;
  bondRemainingTermMonths?: number | null;
  bondInterestPortionOverride?: number | null;
  bondPrincipalPortionOverride?: number | null;
};

export function mapPropertyRow(row: Record<string, unknown>): PropertyBondRow {
  return {
    outstandingBondBalance: row.outstanding_bond_balance as number | null,
    monthlyBondPayment: row.monthly_bond_payment as number | null,
    bondAnnualInterestRatePercent: row.bond_annual_interest_rate_percent as number | null,
    bondTermYears: row.bond_term_years as number | null,
    bondStartDate: row.bond_start_date != null ? String(row.bond_start_date).slice(0, 10) : null,
    bondRemainingTermMonths: row.bond_remaining_term_months as number | null,
    bondInterestPortionOverride: row.bond_interest_portion_override as number | null,
    bondPrincipalPortionOverride: row.bond_principal_portion_override as number | null
  };
}

async function findActiveBondExpenseInDueMonth(
  sb: SupabaseClient,
  uid: string,
  propertyId: string,
  dueYmd: string
) {
  const { gte, lt } = utcMonthBoundsForDueYmd(dueYmd);
  const { data } = await sb
    .from("expense_entries")
    .select("id")
    .eq("user_id", uid)
    .eq("property_id", propertyId)
    .eq("category", "BOND_PAYMENT")
    .eq("status", "ACTIVE")
    .gte("expense_date", gte)
    .lt("expense_date", lt)
    .limit(1)
    .maybeSingle();
  return data;
}

function resolveBondRowAmount(property: PropertyBondRow, expenseDay: Date): number | null {
  const bfSchedule = computePropertyBondFinance(property, expenseDay);
  const calc = bfSchedule.calculatedMonthlyPayment;
  const storedDebit = bfSchedule.monthlyBondPaymentStored;
  const fallbackPay = bfSchedule.paymentThisMonth;
  let rowAmount: number | null = null;
  if (storedDebit != null && storedDebit > 0) rowAmount = storedDebit;
  else if (calc != null && calc > 0) rowAmount = calc;
  else if (fallbackPay != null && fallbackPay > 0) rowAmount = fallbackPay;
  return rowAmount != null ? Math.round(Number(rowAmount) * 100) / 100 : null;
}

async function createBondStatementExpense(
  sb: SupabaseClient,
  uid: string,
  propertyId: string,
  property: PropertyBondRow,
  dueYmd: string
) {
  const expenseDay = expenseDateFromYmd(dueYmd);
  const rowAmount = resolveBondRowAmount(property, expenseDay);
  if (rowAmount == null || rowAmount <= 0) {
    return {
      ok: false as const,
      message:
        "Could not derive a payment amount for this date. Set outstanding balance, interest rate, and term (or monthly payment) on the bond profile."
    };
  }

  const bfSplit = computePropertyBondFinance({ ...property, monthlyBondPayment: rowAmount }, expenseDay);
  const ym = dueYmd.slice(0, 7);

  const { data, error } = await sb
    .from("expense_entries")
    .insert({
      user_id: uid,
      property_id: propertyId,
      category: "BOND_PAYMENT",
      description: `Bond payment (${ym})`,
      amount: rowAmount,
      expense_date: expenseDay.toISOString(),
      is_recurring: false,
      recurring_frequency: null,
      recurring_schedule_parent_id: null,
      recurring_start_date: null,
      recurring_end_date: null,
      recurring_open_ended: false,
      recurring_month_anchor: null,
      recurring_day_of_month: null,
      bond_interest_amount: bfSplit.interestThisMonth,
      bond_principal_amount: bfSplit.principalThisMonth,
      source: "MANUAL_FINANCIAL_ENTRY",
      status: "ACTIVE"
    })
    .select("*")
    .single();

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, expense: data };
}

export async function loadOwnedProperty(
  sb: SupabaseClient,
  uid: string,
  propertyId: string
): Promise<PropertyBondRow | null> {
  const { data, error } = await sb
    .from("properties")
    .select(
      "id, outstanding_bond_balance, monthly_bond_payment, bond_annual_interest_rate_percent, bond_term_years, bond_start_date, bond_remaining_term_months, bond_interest_portion_override, bond_principal_portion_override"
    )
    .eq("id", propertyId)
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return mapPropertyRow(data as Record<string, unknown>);
}

export async function previewBondAtDate(
  property: PropertyBondRow,
  dueYmd: string
): Promise<{ dueDate: string; bondFinance: ReturnType<typeof computePropertyBondFinance> }> {
  const expenseDay = expenseDateFromYmd(dueYmd);
  return { dueDate: dueYmd, bondFinance: computePropertyBondFinance(property, expenseDay) };
}

export async function postBondStatementRow(
  sb: SupabaseClient,
  uid: string,
  propertyId: string,
  dueYmd: string
) {
  if (!isValidYmd(dueYmd)) {
    return { ok: false as const, status: 400 as const, message: "dueDate must be YYYY-MM-DD" };
  }

  const property = await loadOwnedProperty(sb, uid, propertyId);
  if (!property) {
    return { ok: false as const, status: 404 as const, message: "Property not found" };
  }

  const dup = await findActiveBondExpenseInDueMonth(sb, uid, propertyId, dueYmd);
  if (dup) {
    return {
      ok: false as const,
      status: 409 as const,
      message:
        "There is already a bond payment on the statement for that calendar month. Open the Statement tab and edit or delete that row.",
      duplicateExpenseId: dup.id
    };
  }

  const created = await createBondStatementExpense(sb, uid, propertyId, property, dueYmd);
  if (!created.ok) {
    return { ok: false as const, status: 400 as const, message: created.message };
  }

  return { ok: true as const, status: 201 as const, expense: created.expense };
}

export async function backfillBondStatementRows(
  sb: SupabaseClient,
  uid: string,
  propertyId: string,
  startYmd: string,
  endYmd: string,
  opts?: { maxMonths?: number }
) {
  const maxMonths = opts?.maxMonths ?? 240;

  if (!isValidYmd(startYmd) || !isValidYmd(endYmd)) {
    return { ok: false as const, status: 400 as const, message: "startDate and endDate must be YYYY-MM-DD" };
  }
  if (startYmd > endYmd) {
    return { ok: false as const, status: 400 as const, message: "startDate must be on or before endDate" };
  }

  const property = await loadOwnedProperty(sb, uid, propertyId);
  if (!property) {
    return { ok: false as const, status: 404 as const, message: "Property not found" };
  }

  const dueList = enumerateBondDueYmdsInRange(startYmd, endYmd);
  if (dueList.length > maxMonths) {
    return {
      ok: false as const,
      status: 400 as const,
      message: `Date range spans more than ${maxMonths} months. Choose a shorter range.`
    };
  }

  const createdIds: string[] = [];
  const skipped: Array<{ dueYmd: string; reason: string }> = [];

  for (const dueYmd of dueList) {
    const dup = await findActiveBondExpenseInDueMonth(sb, uid, propertyId, dueYmd);
    if (dup) {
      skipped.push({ dueYmd, reason: "already_has_bond_expense" });
      continue;
    }
    const row = await createBondStatementExpense(sb, uid, propertyId, property, dueYmd);
    if (!row.ok) {
      skipped.push({ dueYmd, reason: "no_derivable_amount" });
      continue;
    }
    createdIds.push(String((row.expense as { id: string }).id));
  }

  return {
    ok: true as const,
    status: 201 as const,
    createdCount: createdIds.length,
    createdIds,
    skipped
  };
}
