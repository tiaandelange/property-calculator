import { db } from "../../config/db.js";
import { computeFinancialSummary } from "./property.financials.service.js";
import { isCurrentLeaseStatus, leaseDisplayStatus } from "./propertyLease.helpers.js";

export type PropertyAggregate = {
  property: Record<string, unknown>;
  tenants: unknown[];
  leases: unknown[];
  documents: unknown[];
  incomeEntries: unknown[];
  expenses: unknown[];
  invoices: unknown[];
  recurringIncomeRules: unknown[];
  financialSummary: Awaited<ReturnType<typeof computeFinancialSummary>>;
  occupancyStatus: string;
  leaseDisplayStatus: string;
  currentTenant: { id: number; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  /** All active / month-to-month leases (e.g. duplex units). */
  currentLeases: Array<Record<string, unknown>>;
  /** Same shape as before: first current lease, for older clients. */
  currentLease: Record<string, unknown> | null;
  combinedMonthlyRentFromLeases: number;
  allTenantsCount: number;
  recentIncome: unknown[];
  recentExpenses: unknown[];
  historicalLeaseSummaries: Array<{ id: number; displayStatus: string; startDate: Date; fixedTermEndDate: Date | null; tenantLabel: string | null }>;
  alerts: string[];
  counts: {
    leases: number;
    tenants: number;
    expenses: number;
    incomeEntries: number;
    documents: number;
    currentLeases: number;
  };
};

export async function buildPropertyAggregate(
  userId: number,
  propertyId: number,
  opts?: { financialSummaryMonth?: string | null }
): Promise<PropertyAggregate | null> {
  const row = await db.property.findFirst({
    where: { id: propertyId, userId },
    include: {
      tenants: true,
      leases: { include: { tenant: true }, orderBy: { createdAt: "desc" } },
      documents: true,
      incomeEntries: { where: { status: { not: "ARCHIVED" as const } }, orderBy: { incomeDate: "desc" } },
      expenses: { where: { status: { not: "ARCHIVED" as const } }, orderBy: { expenseDate: "desc" } },
      invoices: { include: { lineItems: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!row) return null;

  const {
    tenants,
    leases,
    documents,
    incomeEntries,
    expenses,
    invoices,
    ...propertyCore
  } = row;

  const leasesWithDisplay = leases.map((l) => ({
    ...l,
    displayStatus: leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })
  }));

  const currentLeaseFullList = leasesWithDisplay.filter((l) => isCurrentLeaseStatus(l.displayStatus));
  const currentLeaseFull = currentLeaseFullList[0] ?? null;
  const currentLeaseDisplayStatus = currentLeaseFull ? currentLeaseFull.displayStatus : "VACANT";
  const directTenant = tenants.find((t) => t.status === "ACTIVE") ?? null;
  const currentTenantRaw = (currentLeaseFull?.tenant as { id: number; firstName: string; lastName: string; email: string | null; phone: string | null } | null) ?? directTenant;
  const occupancyStatus = currentLeaseFullList.length > 0 || directTenant ? "OCCUPIED" : "VACANT";

  const currentTenant = currentTenantRaw
    ? {
        id: currentTenantRaw.id,
        firstName: currentTenantRaw.firstName,
        lastName: currentTenantRaw.lastName,
        email: currentTenantRaw.email ?? null,
        phone: currentTenantRaw.phone ?? null
      }
    : null;

  const mapLeaseCore = (l: (typeof leasesWithDisplay)[0]) => ({
    id: l.id,
    leaseType: l.leaseType,
    status: l.status,
    displayStatus: l.displayStatus,
    startDate: l.startDate,
    fixedTermEndDate: l.fixedTermEndDate,
    monthlyRent: l.monthlyRent,
    depositAmount: l.depositAmount,
    rentDueDay: l.rentDueDay,
    tenant: l.tenant
  });

  const currentLeases = currentLeaseFullList.map((l) => mapLeaseCore(l) as unknown as Record<string, unknown>);

  const currentLease = currentLeaseFull
    ? (mapLeaseCore(currentLeaseFull) as unknown as Record<string, unknown>)
    : null;

  const combinedMonthlyRentFromLeases = currentLeaseFullList.reduce((a, l) => a + Number(l.monthlyRent ?? 0), 0);

  const historicalLeaseSummaries = leasesWithDisplay
    .filter((l) => !isCurrentLeaseStatus(l.displayStatus))
    .map((l) => ({
      id: l.id,
      displayStatus: l.displayStatus,
      startDate: l.startDate,
      fixedTermEndDate: l.fixedTermEndDate,
      tenantLabel: l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : null
    }));

  const financialSummary = await computeFinancialSummary(userId, propertyId, {
    calendarMonth: opts?.financialSummaryMonth ?? undefined
  });

  const recurringIncomeRules = await db.recurringIncomeRule.findMany({
    where: { userId, propertyId },
    orderBy: { createdAt: "desc" }
  });

  const alerts: string[] = [];
  if (currentLeaseFullList.length > 0 && !(documents as { length: number }).length) {
    alerts.push("Upload key documents (lease agreement, municipal account, insurance) when ready.");
  }
  if (!expenses.length && !incomeEntries.length && currentLeaseFullList.length === 0) {
    alerts.push("No operating ledger entries yet — financial summaries stay at zero until you add income or expenses.");
  }

  return {
    property: propertyCore as unknown as Record<string, unknown>,
    tenants,
    leases: leasesWithDisplay,
    documents,
    incomeEntries,
    expenses,
    invoices,
    recurringIncomeRules,
    financialSummary,
    occupancyStatus,
    leaseDisplayStatus: currentLeaseDisplayStatus,
    currentTenant,
    currentLeases,
    currentLease,
    combinedMonthlyRentFromLeases,
    allTenantsCount: tenants.length,
    recentIncome: incomeEntries.slice(0, 15),
    recentExpenses: expenses.slice(0, 15),
    historicalLeaseSummaries,
    alerts,
    counts: {
      leases: leases.length,
      tenants: tenants.length,
      expenses: expenses.length,
      incomeEntries: incomeEntries.length,
      documents: documents.length,
      currentLeases: currentLeaseFullList.length
    }
  };
}

/** Flatten aggregate into the legacy GET /properties/:id JSON shape expected by older clients. */
export function mapAggregateToLegacyDetail(agg: PropertyAggregate) {
  return {
    ...(agg.property as object),
    tenants: agg.tenants,
    leases: agg.leases,
    documents: agg.documents,
    incomeEntries: agg.incomeEntries,
    expenses: agg.expenses,
    invoices: agg.invoices,
    recurringIncomeRules: agg.recurringIncomeRules,
    financialSummary: agg.financialSummary,
    occupancyStatus: agg.occupancyStatus,
    leaseDisplayStatus: agg.leaseDisplayStatus,
    currentTenant: agg.currentTenant,
    currentLeases: agg.currentLeases,
    currentLease: agg.currentLease,
    combinedMonthlyRentFromLeases: agg.combinedMonthlyRentFromLeases,
    allTenantsCount: agg.allTenantsCount,
    aggregateMeta: {
      alerts: agg.alerts,
      counts: agg.counts,
      recentIncome: agg.recentIncome,
      recentExpenses: agg.recentExpenses,
      historicalLeaseSummaries: agg.historicalLeaseSummaries
    }
  };
}
