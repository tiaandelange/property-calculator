import type { PropertyExpenseCategory } from "@prisma/client";
import { db } from "../../config/db.js";

export type BackfillInput = {
  startMonth: string;
  endMonth: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  expenseBreakdown?: Array<{ category: string; amount: number }>;
  status: "EXPECTED" | "RECEIVED";
  includeBondPayment?: boolean;
  bondAmount?: number;
  notes?: string;
};

function parseYm(s: string) {
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)) - 1;
  return new Date(y, m, 1);
}

function ymRange(startMonth: string, endMonth: string): string[] {
  const s = parseYm(startMonth);
  const e = parseYm(endMonth);
  if (!s || !e || s > e) return [];
  const out: string[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function monthDate(ym: string, day: number) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, Math.min(day, 28));
}

export async function runHistoricalBackfill(userId: number, propertyId: number, input: BackfillInput) {
  const property = await db.property.findFirst({ where: { id: propertyId, userId } });
  if (!property) return { ok: false as const, message: "Property not found" };

  const months = ymRange(input.startMonth, input.endMonth);
  if (!months.length) return { ok: false as const, message: "Invalid month range" };

  let incomeCreated = 0;
  let expenseCreated = 0;
  let skipped = 0;

  const incomeStatus = input.status;
  const noteSuffix = input.notes ? ` — ${input.notes}` : "";

  await db.$transaction(async (tx) => {
    for (const ym of months) {
      const start = parseYm(ym)!;
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

      const incomeAmt = input.monthlyIncome;
      if (incomeAmt > 0) {
        const skipInc = await tx.propertyIncome.findFirst({
          where: {
            userId,
            propertyId,
            category: "RENT",
            source: "HISTORICAL_BACKFILL",
            incomeDate: { gte: start, lt: end }
          }
        });
        if (skipInc) skipped += 1;
        else {
          await tx.propertyIncome.create({
            data: {
              userId,
              propertyId,
              category: "RENT",
              description: `Historical backfill ${ym}${noteSuffix}`,
              amount: incomeAmt,
              incomeDate: monthDate(ym, 1),
              source: "HISTORICAL_BACKFILL",
              status: incomeStatus
            }
          });
          incomeCreated += 1;
        }
      }

      const breakdown =
        input.expenseBreakdown && input.expenseBreakdown.length > 0
          ? input.expenseBreakdown
          : input.monthlyExpenses > 0
            ? [{ category: "OTHER", amount: input.monthlyExpenses }]
            : [];

      for (const row of breakdown) {
        if (row.amount <= 0) continue;
        const category = row.category as PropertyExpenseCategory;
        const skipEx = await tx.propertyExpense.findFirst({
          where: {
            userId,
            propertyId,
            category,
            source: "HISTORICAL_BACKFILL",
            expenseDate: { gte: start, lt: end }
          }
        });
        if (skipEx) {
          skipped += 1;
          continue;
        }
        await tx.propertyExpense.create({
          data: {
            userId,
            propertyId,
            category,
            description: `Historical backfill ${ym}${noteSuffix}`,
            amount: row.amount,
            expenseDate: monthDate(ym, 5),
            isRecurring: false,
            source: "HISTORICAL_BACKFILL",
            status: "ACTIVE"
          }
        });
        expenseCreated += 1;
      }

      if (input.includeBondPayment && input.bondAmount != null && input.bondAmount > 0) {
        const bondSkip = await tx.propertyExpense.findFirst({
          where: {
            userId,
            propertyId,
            category: "BOND_PAYMENT",
            source: "HISTORICAL_BACKFILL",
            expenseDate: { gte: start, lt: end }
          }
        });
        if (bondSkip) skipped += 1;
        else {
          await tx.propertyExpense.create({
            data: {
              userId,
              propertyId,
              category: "BOND_PAYMENT",
              description: `Historical bond payment ${ym}${noteSuffix}`,
              amount: input.bondAmount,
              expenseDate: monthDate(ym, 7),
              isRecurring: false,
              source: "HISTORICAL_BACKFILL",
              status: "ACTIVE"
            }
          });
          expenseCreated += 1;
        }
      }
    }
  });

  return {
    ok: true as const,
    monthsProcessed: months.length,
    incomeEntriesCreated: incomeCreated,
    expenseEntriesCreated: expenseCreated,
    skippedDuplicates: skipped
  };
}
