import type { Prisma } from "@prisma/client";

/** UTC [start, end) for a calendar month — matches stored expense/income calendar dates (UTC). */
export function utcCalendarMonthBounds(calendarMonthYyyyMm: string | null | undefined, fallbackInstant: Date): { start: Date; end: Date } {
  const ym = calendarMonthYyyyMm?.trim();
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const y = Number(ym.slice(0, 4));
    const mo = Number(ym.slice(5, 7));
    if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      return {
        start: new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0)),
        end: new Date(Date.UTC(y, mo, 1, 0, 0, 0))
      };
    }
  }
  const y = fallbackInstant.getUTCFullYear();
  const m0 = fallbackInstant.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(y, m0 + 1, 1, 0, 0, 0))
  };
}

/**
 * Calendar-month KPIs (portfolio dashboard, property financials snapshot): ONLY expenses whose
 * `expenseDate` falls in `[monthStart, monthEnd)`, aligned with the workspace statement (templates
 * are hidden there; dated rows — including materialised recurring SYSTEM lines — carry the calendar date).
 *
 * Previously this helper also OR‑matched “legacy” recurring templates with null schedule fields,
 * which inflated **every** month’s totals while those templates never appeared on the statement —
 * deleted line items could still look “alive” on the dashboard via that phantom path.
 */
export function whereActiveExpensesForPropertyMonthSnapshot(
  userId: number,
  propertyId: number,
  monthStart: Date,
  monthEnd: Date
): Prisma.PropertyExpenseWhereInput {
  return {
    userId,
    propertyId,
    status: "ACTIVE",
    expenseDate: { gte: monthStart, lt: monthEnd }
  };
}

export function whereActiveExpensesForPortfolioMonthSnapshot(
  userId: number,
  propertyIds: number[],
  monthStart: Date,
  monthEnd: Date
): Prisma.PropertyExpenseWhereInput {
  return {
    userId,
    propertyId: { in: propertyIds.length ? propertyIds : [-1] },
    status: "ACTIVE",
    expenseDate: { gte: monthStart, lt: monthEnd }
  };
}
