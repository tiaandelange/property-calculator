import type { PrismaClient } from "@prisma/client";

const SINGLETON_ID = 1;

export async function getPortfolioProjectionGrowthRates(db: PrismaClient) {
  let row = await db.portfolioProjectionDefaults.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    row = await db.portfolioProjectionDefaults.create({
      data: {
        id: SINGLETON_ID,
        rentalIncomeGrowthPercentAnnual: 6,
        totalExpensesGrowthPercentAnnual: 6
      }
    });
  }
  return {
    rentalIncomeGrowthPercentAnnual: row.rentalIncomeGrowthPercentAnnual,
    totalExpensesGrowthPercentAnnual: row.totalExpensesGrowthPercentAnnual
  };
}

export async function updatePortfolioProjectionGrowthRates(
  db: PrismaClient,
  patch: { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number }
) {
  const clamp = (x: number) => Math.min(50, Math.max(-50, x));
  const data: Record<string, number> = {};
  if (patch.rentalIncomeGrowthPercentAnnual != null && Number.isFinite(patch.rentalIncomeGrowthPercentAnnual)) {
    data.rentalIncomeGrowthPercentAnnual = clamp(patch.rentalIncomeGrowthPercentAnnual);
  }
  if (patch.totalExpensesGrowthPercentAnnual != null && Number.isFinite(patch.totalExpensesGrowthPercentAnnual)) {
    data.totalExpensesGrowthPercentAnnual = clamp(patch.totalExpensesGrowthPercentAnnual);
  }
  if (Object.keys(data).length === 0) return getPortfolioProjectionGrowthRates(db);
  await db.portfolioProjectionDefaults.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      rentalIncomeGrowthPercentAnnual: data.rentalIncomeGrowthPercentAnnual ?? 6,
      totalExpensesGrowthPercentAnnual: data.totalExpensesGrowthPercentAnnual ?? 6
    },
    update: data
  });
  return getPortfolioProjectionGrowthRates(db);
}
