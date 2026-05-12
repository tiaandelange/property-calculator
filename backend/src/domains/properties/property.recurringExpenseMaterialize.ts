import { db } from "../../config/db.js";
import type { RecurringExpenseMonthAnchor } from "@prisma/client";
import { computePropertyBondFinance } from "./property.bond.helpers.js";

export function isExpenseScheduleTemplate(ex: {
  isRecurring: boolean;
  recurringScheduleParentId: number | null;
}): boolean {
  return Boolean(ex.isRecurring && ex.recurringScheduleParentId == null);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function anchorYmdInMonthUtc(
  year: number,
  month0: number,
  anchor: RecurringExpenseMonthAnchor,
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

export function nextCalendarMonthUtc(y: number, m0: number): { y: number; m0: number } {
  const d = new Date(Date.UTC(y, m0 + 1, 1));
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth() };
}

/** First occurrence anchor date (YYYY-MM-DD) that falls on or after startYmd (inclusive). */
export function firstDueYmdOnOrAfter(
  startYmd: string,
  anchor: RecurringExpenseMonthAnchor,
  dayOfMonth?: number | null
): string {
  let { y, m0 } = parseYmd(startYmd);
  for (let i = 0; i < 600; i++) {
    const due = anchorYmdInMonthUtc(y, m0, anchor, dayOfMonth);
    if (compareYmd(due, startYmd) >= 0) return due;
    ({ y, m0 } = nextCalendarMonthUtc(y, m0));
  }
  const { y: yy, m0: mm } = parseYmd(startYmd);
  return anchorYmdInMonthUtc(yy, mm, anchor, dayOfMonth);
}

export function expenseDateFromYmd(ymd: string): Date {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
}

/** Inclusive UTC midnight start / exclusive next-day UTC midnight — matches any timestamp on that calendar day. */
export function utcCalendarDayBoundsUtc(ymd: string): { gte: Date; lt: Date } {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  const gte = new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0));
  const lt = new Date(Date.UTC(yy, mm - 1, dd + 1, 0, 0, 0));
  return { gte, lt };
}

export async function materializeDueRecurringExpenses(userId: number, propertyId: number): Promise<{ created: number }> {
  const templates = await db.propertyExpense.findMany({
    where: {
      userId,
      propertyId,
      status: "ACTIVE",
      isRecurring: true,
      recurringScheduleParentId: null
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const t of templates) {
    const anchor = (t.recurringMonthAnchor ?? "FIRST_OF_MONTH") as RecurringExpenseMonthAnchor;
    const dom = anchor === "DAY_OF_MONTH" ? t.recurringDayOfMonth : null;
    const openEnded = Boolean(t.recurringOpenEnded);
    const startYmd =
      (t.recurringStartDate ? t.recurringStartDate.toISOString().slice(0, 10) : null) ??
      (t.expenseDate ? t.expenseDate.toISOString().slice(0, 10) : null);
    if (!startYmd) continue;
    const endYmd =
      openEnded || !t.recurringEndDate ? null : t.recurringEndDate.toISOString().slice(0, 10);

    const propertyForBond =
      t.category === "BOND_PAYMENT"
        ? await db.property.findFirst({ where: { id: t.propertyId, userId } })
        : null;

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
      const dayBounds = utcCalendarDayBoundsUtc(dueStr);
      /** Any row for this schedule + calendar day (any status, any time-of-day) blocks duplicates / resurrection after archive-delete. */
      const exists = await db.propertyExpense.findFirst({
        where: {
          recurringScheduleParentId: t.id,
          expenseDate: { gte: dayBounds.gte, lt: dayBounds.lt }
        }
      });

      if (!exists) {
        let rowAmount = t.amount;
        let bondInterest: number | null = null;
        let bondPrincipal: number | null = null;
        if (t.category === "BOND_PAYMENT" && propertyForBond) {
          const bfSchedule = computePropertyBondFinance(propertyForBond, expenseDay);
          const calc = bfSchedule.calculatedMonthlyPayment;
          const storedDebit = bfSchedule.monthlyBondPaymentStored;
          const fallbackPay = bfSchedule.paymentThisMonth;
          if (storedDebit != null && storedDebit > 0) rowAmount = storedDebit;
          else if (calc != null && calc > 0) rowAmount = calc;
          else if (fallbackPay != null && fallbackPay > 0) rowAmount = fallbackPay;
          /** Split uses the actual posted debit (`rowAmount`), not necessarily the stored profile debit order. */
          const bfSplit = computePropertyBondFinance({ ...propertyForBond, monthlyBondPayment: rowAmount }, expenseDay);
          bondInterest = bfSplit.interestThisMonth;
          bondPrincipal = bfSplit.principalThisMonth;
        }

        await db.propertyExpense.create({
          data: {
            userId: t.userId,
            propertyId: t.propertyId,
            category: t.category,
            description: t.description,
            amount: rowAmount,
            expenseDate: expenseDay,
            isRecurring: false,
            recurringFrequency: null,
            recurringScheduleParentId: t.id,
            recurringStartDate: null,
            recurringEndDate: null,
            recurringOpenEnded: false,
            recurringMonthAnchor: null,
            recurringDayOfMonth: null,
            bondInterestAmount: bondInterest,
            bondPrincipalAmount: bondPrincipal,
            source: "SYSTEM",
            status: "ACTIVE"
          }
        });
        created++;
      }

      ({ y, m0 } = nextCalendarMonthUtc(y, m0));
    }
  }

  return { created };
}

export async function materializeDueRecurringExpensesForProperties(
  userId: number,
  propertyIds: number[]
): Promise<{ created: number }> {
  let created = 0;
  const uniq = [...new Set(propertyIds)];
  for (const pid of uniq) {
    created += (await materializeDueRecurringExpenses(userId, pid)).created;
  }
  return { created };
}
