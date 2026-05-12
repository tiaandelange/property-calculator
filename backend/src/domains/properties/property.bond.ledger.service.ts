import type { Property } from "@prisma/client";
import { db } from "../../config/db.js";
import { computePropertyBondFinance } from "./property.bond.helpers.js";
import { expenseDateFromYmd } from "./property.recurringExpenseMaterialize.js";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string): boolean {
  return YMD_RE.test(s);
}

/** UTC bounds [gte, lt) covering the calendar month of `dueYmd` (year–month from that string). */
export function utcMonthBoundsForDueYmd(dueYmd: string): { gte: Date; lt: Date } {
  const y = Number(dueYmd.slice(0, 4));
  const m = Number(dueYmd.slice(5, 7));
  const gte = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const lt = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { gte, lt };
}

export async function findActiveBondExpenseInDueMonth(userId: number, propertyId: number, dueYmd: string) {
  const { gte, lt } = utcMonthBoundsForDueYmd(dueYmd);
  return db.propertyExpense.findFirst({
    where: {
      userId,
      propertyId,
      category: "BOND_PAYMENT",
      status: "ACTIVE",
      expenseDate: { gte, lt }
    }
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysInUtcMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/** Anchor day within month (clamp short months), month is 1–12. */
export function dueYmdForCalendarMonth(year: number, month1Based: number, preferredDom: number): string {
  const dim = daysInUtcMonth(year, month1Based);
  const d = Math.min(Math.max(1, Math.floor(preferredDom)), dim);
  return `${year}-${pad2(month1Based)}-${pad2(d)}`;
}

/** Each calendar month from `startYmd`'s month through `endYmd`'s month (inclusive), same day-of-month as start when possible. */
export function enumerateBondDueYmdsInRange(startYmd: string, endYmd: string): string[] {
  const sy = Number(startYmd.slice(0, 4));
  const sm = Number(startYmd.slice(5, 7));
  const sd = Number(startYmd.slice(8, 10));
  const ey = Number(endYmd.slice(0, 4));
  const em = Number(endYmd.slice(5, 7));
  const startKey = sy * 12 + sm;
  const endKey = ey * 12 + em;
  if (startKey > endKey) return [];

  const out: string[] = [];
  let y = sy;
  let m = sm;
  while (y * 12 + m <= endKey) {
    out.push(dueYmdForCalendarMonth(y, m, sd));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function resolveBondRowAmount(property: Property, expenseDay: Date): number | null {
  const bfSchedule = computePropertyBondFinance(property, expenseDay);
  const calc = bfSchedule.calculatedMonthlyPayment;
  const storedDebit = bfSchedule.monthlyBondPaymentStored;
  const fallbackPay = bfSchedule.paymentThisMonth;
  let rowAmount: number | null = null;
  /** Profile “monthly bond payment” (actual debit) wins over formula when set — matches user expectation for overrides. */
  if (storedDebit != null && storedDebit > 0) rowAmount = storedDebit;
  else if (calc != null && calc > 0) rowAmount = calc;
  else if (fallbackPay != null && fallbackPay > 0) rowAmount = fallbackPay;
  return rowAmount != null ? Math.round(Number(rowAmount) * 100) / 100 : null;
}

export async function createBondStatementExpense(userId: number, propertyId: number, property: Property, dueYmd: string) {
  const expenseDay = expenseDateFromYmd(dueYmd);
  const rowAmount = resolveBondRowAmount(property, expenseDay);
  if (rowAmount == null || rowAmount <= 0) {
    return {
      ok: false as const,
      code: "NO_AMOUNT" as const,
      message:
        "Could not derive a payment amount for this date. Set outstanding balance, interest rate, and term (or monthly payment) on the bond profile."
    };
  }

  const bfSplit = computePropertyBondFinance({ ...property, monthlyBondPayment: rowAmount }, expenseDay);

  const ym = dueYmd.slice(0, 7);
  const expense = await db.propertyExpense.create({
    data: {
      userId,
      propertyId,
      category: "BOND_PAYMENT",
      description: `Bond payment (${ym})`,
      amount: rowAmount,
      expenseDate: expenseDay,
      isRecurring: false,
      recurringFrequency: null,
      recurringScheduleParentId: null,
      recurringStartDate: null,
      recurringEndDate: null,
      recurringOpenEnded: false,
      recurringMonthAnchor: null,
      recurringDayOfMonth: null,
      bondInterestAmount: bfSplit.interestThisMonth,
      bondPrincipalAmount: bfSplit.principalThisMonth,
      source: "MANUAL_FINANCIAL_ENTRY",
      status: "ACTIVE"
    }
  });

  return { ok: true as const, expense };
}

export async function postBondStatementRow(userId: number, propertyId: number, dueYmd: string) {
  if (!isValidYmd(dueYmd)) {
    return { ok: false as const, status: 400 as const, message: "dueDate must be YYYY-MM-DD" };
  }

  const property = await db.property.findFirst({ where: { id: propertyId, userId } });
  if (!property) {
    return { ok: false as const, status: 404 as const, message: "Property not found" };
  }

  const dup = await findActiveBondExpenseInDueMonth(userId, propertyId, dueYmd);
  if (dup) {
    return {
      ok: false as const,
      status: 409 as const,
      message:
        "There is already a bond payment on the statement for that calendar month. Open the Statement tab and edit or delete that row.",
      duplicateExpenseId: dup.id
    };
  }

  const created = await createBondStatementExpense(userId, propertyId, property, dueYmd);
  if (!created.ok) {
    return { ok: false as const, status: 400 as const, message: created.message };
  }

  return { ok: true as const, status: 201 as const, expense: created.expense };
}

export async function backfillBondStatementRows(
  userId: number,
  propertyId: number,
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

  const property = await db.property.findFirst({ where: { id: propertyId, userId } });
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

  const createdIds: number[] = [];
  const skipped: Array<{ dueYmd: string; reason: string }> = [];

  for (const dueYmd of dueList) {
    const dup = await findActiveBondExpenseInDueMonth(userId, propertyId, dueYmd);
    if (dup) {
      skipped.push({ dueYmd, reason: "already_has_bond_expense" });
      continue;
    }
    const row = await createBondStatementExpense(userId, propertyId, property, dueYmd);
    if (!row.ok) {
      skipped.push({ dueYmd, reason: "no_derivable_amount" });
      continue;
    }
    createdIds.push(row.expense.id);
  }

  return {
    ok: true as const,
    status: 201 as const,
    createdCount: createdIds.length,
    createdIds,
    skipped
  };
}
