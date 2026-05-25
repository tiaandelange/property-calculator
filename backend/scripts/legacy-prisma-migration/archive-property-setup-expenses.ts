/**
 * One-off: archive legacy PropertyExpense rows created from property setup sync (PROPERTY_SETUP source).
 * Run: npx tsx scripts/archive-property-setup-expenses.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.propertyExpense.updateMany({
    where: { source: "PROPERTY_SETUP", status: "ACTIVE" },
    data: { status: "ARCHIVED" }
  });
  console.log(`Archived ${res.count} PROPERTY_SETUP expense rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
