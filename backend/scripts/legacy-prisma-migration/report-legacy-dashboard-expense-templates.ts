/**
 * Lists ACTIVE recurring expense **templates** that used to be counted in **every** dashboard month
 * (legacy rule: monthly recurring + null schedule metadata). They do not appear on the workspace statement,
 * so totals could disagree after deleting dated lines.
 *
 * Run: `npx tsx scripts/report-legacy-dashboard-expense-templates.ts`
 *
 * Resolve by stopping/deleting the schedule in **Financials → recurring**, or hard-delete the template
 * if you intend to remove all generated lines (cascade).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.propertyExpense.findMany({
    where: {
      status: "ACTIVE",
      isRecurring: true,
      recurringFrequency: "MONTHLY",
      recurringScheduleParentId: null,
      recurringMonthAnchor: null,
      recurringStartDate: null
    },
    orderBy: [{ propertyId: "asc" }, { id: "asc" }]
  });

  for (const r of rows) {
    console.log(
      `#${r.id} user=${r.userId} property=${r.propertyId} ${r.category} ${JSON.stringify(r.description)} amt=${r.amount} date=${r.expenseDate.toISOString().slice(0, 10)} source=${r.source}`
    );
  }
  console.log(`--- total: ${rows.length} active legacy-pattern templates (informational after dashboard fix)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
