import { db } from "../../config/db.js";
import { leaseDisplayStatus } from "./propertyLease.helpers.js";
import { utcCalendarMonthBounds, whereActiveExpensesForPropertyMonthSnapshot } from "./propertyExpenseMonth.helpers.js";
import { materializeDueRecurringExpenses } from "./property.recurringExpenseMaterialize.js";

export type ComputeFinancialSummaryOpts = {
  /** `YYYY-MM` from the client (same as dashboard-summary) so Overview matches the user’s calendar month. */
  calendarMonth?: string | null;
};

function sumByCategory<T extends { category: string; amount: number }>(rows: T[], category: string) {
  return rows.filter((r) => r.category === category).reduce((acc, r) => acc + r.amount, 0);
}

export async function computeFinancialSummary(userId: number, propertyId: number, opts?: ComputeFinancialSummaryOpts) {
  const property = await db.property.findFirst({
    where: { id: propertyId, userId },
    include: { leases: true }
  });
  if (!property) return null;

  await materializeDueRecurringExpenses(userId, propertyId);

  const { start, end } = utcCalendarMonthBounds(opts?.calendarMonth ?? null, new Date());
  const [expensesMonth, incomeMonthReceived, incomeMonthExpected, incomeAllReceived, expensesAll, invoicesPaidMonth] = await Promise.all([
    db.propertyExpense.findMany({
      where: whereActiveExpensesForPropertyMonthSnapshot(userId, propertyId, start, end)
    }),
    db.propertyIncome.findMany({ where: { userId, propertyId, status: "RECEIVED", incomeDate: { gte: start, lt: end } } }),
    db.propertyIncome.findMany({ where: { userId, propertyId, status: "EXPECTED", incomeDate: { gte: start, lt: end } } }),
    db.propertyIncome.findMany({ where: { userId, propertyId, status: "RECEIVED" } }),
    db.propertyExpense.findMany({ where: { userId, propertyId, status: "ACTIVE" } }),
    db.invoice.findMany({
      where: { userId, propertyId, status: "PAID", invoiceDate: { gte: start, lt: end } },
      select: { total: true }
    })
  ]);

  /** Paid lease invoices are statement credits but do not create PropertyIncome rows — include them so Overview matches the ledger view */
  const invoiceIncomeMonth = (invoicesPaidMonth ?? []).reduce((a, inv) => a + Number(inv.total), 0);

  const totalRentIncome = sumByCategory(incomeMonthReceived as any, "RENT") + invoiceIncomeMonth;
  const totalIncome = incomeMonthReceived.reduce((a, b) => a + b.amount, 0) + invoiceIncomeMonth;
  const totalOtherIncome = totalIncome - totalRentIncome;
  const expectedIncome = incomeMonthExpected.reduce((a, b) => a + b.amount, 0);

  const totalRatesTaxes = sumByCategory(expensesMonth as any, "RATES_TAXES");
  const totalWater = sumByCategory(expensesMonth as any, "WATER");
  const totalElectricity = sumByCategory(expensesMonth as any, "ELECTRICITY");
  const totalLevies = sumByCategory(expensesMonth as any, "LEVIES");
  const totalInsurance = sumByCategory(expensesMonth as any, "INSURANCE");
  const totalMaintenance = sumByCategory(expensesMonth as any, "MAINTENANCE") + sumByCategory(expensesMonth as any, "REPAIRS");
  let totalBondPayment = sumByCategory(expensesMonth as any, "BOND_PAYMENT");
  let totalExpenses = expensesMonth.reduce((a, b) => a + b.amount, 0);
  const bondFromProfile =
    totalBondPayment <= 0 ? Number(property.monthlyBondPayment ?? 0) : 0;
  if (bondFromProfile > 0) {
    totalBondPayment = bondFromProfile;
    totalExpenses += bondFromProfile;
  }
  const totalOtherExpenses =
    totalExpenses -
    (totalRatesTaxes + totalWater + totalElectricity + totalLevies + totalInsurance + totalMaintenance + totalBondPayment);
  const netMonthlyCashFlow = totalIncome - totalExpenses;

  const annualIncome = incomeAllReceived.reduce((a, b) => a + b.amount, 0);
  const annualExpenses = expensesAll.reduce((a, b) => a + b.amount, 0);
  const annualNetCashFlow = annualIncome - annualExpenses;
  const annualRent = incomeAllReceived.filter((i) => i.category === "RENT").reduce((a, b) => a + b.amount, 0);
  const grossYield = property.purchasePrice > 0 ? annualRent / property.purchasePrice : 0;
  const netYield = property.purchasePrice > 0 ? annualNetCashFlow / property.purchasePrice : 0;
  const outstandingLoanAmount = property.outstandingBondBalance ?? 0;
  const estimatedEquity = property.currentEstimatedValue != null ? property.currentEstimatedValue - outstandingLoanAmount : null;
  const hasActiveLease = property.leases.some((l) =>
    ["ACTIVE", "MONTH_TO_MONTH"].includes(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))
  );
  const occupancyStatus = hasActiveLease ? "Occupied" : "Vacant";

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
