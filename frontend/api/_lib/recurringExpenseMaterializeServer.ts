import type { SupabaseClient } from "@supabase/supabase-js";
import { computePropertyBondFinance } from "./bondHelpers";
import { mapPropertyRow, type PropertyBondRow } from "./bondLedgerServer";
import { expenseDateFromYmd } from "./bondYmd";

type MonthAnchor = "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function anchorYmdInMonthUtc(
  year: number,
  month0: number,
  anchor: MonthAnchor,
  dayOfMonth?: number | null
): string {
  if (anchor === "FIRST_OF_MONTH") return `${year}-${pad(month0 + 1)}-01`;
  if (anchor === "LAST_OF_MONTH") {
    const lastDay = daysInMonthUtc(year, month0);
    return `${year}-${pad(month0 + 1)}-${pad(lastDay)}`;
  }
  const dim = daysInMonthUtc(year, month0);
  const dom = Math.min(Math.max(1, Number(dayOfMonth) || 1), 31);
  const d = Math.min(dom, dim);
  return `${year}-${pad(month0 + 1)}-${pad(d)}`;
}

function parseYmd(ymd: string): { y: number; m0: number } {
  const [y, m] = ymd.split("-").map(Number);
  return { y, m0: m - 1 };
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

function nextCalendarMonthUtc(y: number, m0: number): { y: number; m0: number } {
  const d = new Date(Date.UTC(y, m0 + 1, 1));
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth() };
}

function utcCalendarDayBoundsIso(ymd: string): { gte: string; lt: string } {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  const gte = new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0)).toISOString();
  const lt = new Date(Date.UTC(yy, mm - 1, dd + 1, 0, 0, 0)).toISOString();
  return { gte, lt };
}

export async function materializeDueRecurringExpenses(
  sb: SupabaseClient,
  uid: string,
  propertyId: string
): Promise<{ created: number }> {
  const { data: templates, error } = await sb
    .from("expense_entries")
    .select("*")
    .eq("user_id", uid)
    .eq("property_id", propertyId)
    .eq("status", "ACTIVE")
    .eq("is_recurring", true)
    .is("recurring_schedule_parent_id", null);

  if (error) throw new Error(error.message);

  let propertyForBond: PropertyBondRow | null = null;
  const todayStr = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const t of templates ?? []) {
    const row = t as Record<string, unknown>;
    const anchor = (String(row.recurring_month_anchor ?? "FIRST_OF_MONTH") as MonthAnchor) || "FIRST_OF_MONTH";
    const dom = anchor === "DAY_OF_MONTH" ? (row.recurring_day_of_month as number | null) : null;
    const openEnded = Boolean(row.recurring_open_ended);
    const startYmd =
      (row.recurring_start_date != null ? String(row.recurring_start_date).slice(0, 10) : null) ??
      (row.expense_date != null ? String(row.expense_date).slice(0, 10) : null);
    if (!startYmd) continue;
    const endYmd =
      openEnded || row.recurring_end_date == null ? null : String(row.recurring_end_date).slice(0, 10);

    if (String(row.category) === "BOND_PAYMENT" && !propertyForBond) {
      propertyForBond = await (async () => {
        const { data: prop } = await sb
          .from("properties")
          .select(
            "outstanding_bond_balance, monthly_bond_payment, bond_annual_interest_rate_percent, bond_term_years, bond_start_date, bond_remaining_term_months, bond_interest_portion_override, bond_principal_portion_override"
          )
          .eq("id", propertyId)
          .eq("user_id", uid)
          .maybeSingle();
        return prop ? mapPropertyRow(prop as Record<string, unknown>) : null;
      })();
    }

    let { y, m0 } = parseYmd(startYmd);

    for (let guard = 0; guard < 240; guard++) {
      const dueStr = anchorYmdInMonthUtc(y, m0, anchor, dom);
      if (compareYmd(dueStr, todayStr) > 0) break;
      if (compareYmd(dueStr, startYmd) < 0) {
        ({ y, m0 } = nextCalendarMonthUtc(y, m0));
        continue;
      }
      if (endYmd != null && compareYmd(dueStr, endYmd) > 0) break;

      const expenseDay = expenseDateFromYmd(dueStr);
      const dayBounds = utcCalendarDayBoundsIso(dueStr);
      const templateId = String(row.id);

      const { data: exists } = await sb
        .from("expense_entries")
        .select("id")
        .eq("recurring_schedule_parent_id", templateId)
        .gte("expense_date", dayBounds.gte)
        .lt("expense_date", dayBounds.lt)
        .limit(1)
        .maybeSingle();

      if (!exists) {
        let rowAmount = Number(row.amount);
        let bondInterest: number | null = null;
        let bondPrincipal: number | null = null;
        if (String(row.category) === "BOND_PAYMENT" && propertyForBond) {
          const bfSchedule = computePropertyBondFinance(propertyForBond, expenseDay);
          const calc = bfSchedule.calculatedMonthlyPayment;
          const storedDebit = bfSchedule.monthlyBondPaymentStored;
          const fallbackPay = bfSchedule.paymentThisMonth;
          if (storedDebit != null && storedDebit > 0) rowAmount = storedDebit;
          else if (calc != null && calc > 0) rowAmount = calc;
          else if (fallbackPay != null && fallbackPay > 0) rowAmount = fallbackPay;
          const bfSplit = computePropertyBondFinance(
            { ...propertyForBond, monthlyBondPayment: rowAmount },
            expenseDay
          );
          bondInterest = bfSplit.interestThisMonth;
          bondPrincipal = bfSplit.principalThisMonth;
        }

        const { error: insErr } = await sb.from("expense_entries").insert({
          user_id: uid,
          property_id: propertyId,
          category: row.category,
          description: row.description,
          amount: rowAmount,
          expense_date: expenseDay.toISOString(),
          is_recurring: false,
          recurring_frequency: null,
          recurring_schedule_parent_id: templateId,
          recurring_start_date: null,
          recurring_end_date: null,
          recurring_open_ended: false,
          recurring_month_anchor: null,
          recurring_day_of_month: null,
          bond_interest_amount: bondInterest,
          bond_principal_amount: bondPrincipal,
          source: "SYSTEM",
          status: "ACTIVE"
        });
        if (!insErr) created += 1;
      }

      ({ y, m0 } = nextCalendarMonthUtc(y, m0));
    }
  }

  return { created };
}

export async function materializeDueRecurringExpensesForUser(
  sb: SupabaseClient,
  uid: string
): Promise<{ createdCount: number }> {
  const { data: grouped, error } = await sb
    .from("expense_entries")
    .select("property_id")
    .eq("user_id", uid)
    .eq("status", "ACTIVE")
    .eq("is_recurring", true)
    .is("recurring_schedule_parent_id", null);

  if (error) throw new Error(error.message);

  const propertyIds = [...new Set((grouped ?? []).map((r) => String((r as { property_id: string }).property_id)))];
  let createdCount = 0;
  for (const pid of propertyIds) {
    createdCount += (await materializeDueRecurringExpenses(sb, uid, pid)).created;
  }
  return { createdCount };
}
