import {
  derivePropertyOccupancy,
  effectiveActiveUnitCount,
  structureTypeIdFromProperty
} from "../../utils/propertyOccupancy";
import { buildPropertyFinancialOverview } from "../properties/financials/propertyFinancialsAdapter";
import {
  computeCashOnCashRoiPercent,
  computeEquity,
  computeGrossYieldPercent,
  computeNetYieldPercent,
  parseFinancialNumber,
  resolveCashInvested
} from "./financialCalculations";
import type { PropertyFinancialSummary } from "./financialTypes";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function formatUnitsOccupiedDisplay(
  property: Record<string, unknown>,
  occupiedUnits: number,
  totalUnits: number
): string {
  const inv = property.investmentType != null ? String(property.investmentType) : "";
  if (inv === "SHORT_TERM_RENTAL") {
    const rate = property.occupancyRate;
    if (rate != null && !Number.isNaN(Number(rate))) {
      return `${Math.round(Number(rate) * (Number(rate) <= 1 ? 100 : 1))}%`;
    }
  }
  if (totalUnits <= 1) {
    return occupiedUnits > 0 ? "1 / 1" : "0 / 1";
  }
  return `${occupiedUnits} / ${totalUnits}`;
}

export type BuildPropertyFinancialSummaryParams = {
  propertyId: string;
  propertyDetail: Record<string, unknown> | null;
  currentLeases: unknown[];
  recurringChargesLandlord: unknown[];
  statement: Record<string, unknown> | null;
  deposits?: unknown[];
  additionalBondMonthlyTotal?: number;
};

/** Builds the canonical property financial summary used across overview, financials, and reports. */
export function buildPropertyFinancialSummary(
  params: BuildPropertyFinancialSummaryParams
): PropertyFinancialSummary {
  const pf = params.propertyDetail ?? {};
  const overview = buildPropertyFinancialOverview({
    propertyId: params.propertyId,
    propertyDetail: params.propertyDetail,
    currentLeases: params.currentLeases,
    recurringChargesLandlord: params.recurringChargesLandlord,
    statement: params.statement,
    deposits: params.deposits ?? [],
    additionalBondMonthlyTotal: params.additionalBondMonthlyTotal ?? 0
  });

  const marketValue = parseFinancialNumber(pf.currentEstimatedValue);
  const loanBalance = parseFinancialNumber(pf.outstandingBondBalance);
  const purchasePrice = parseFinancialNumber(pf.purchasePrice);
  const cashInvested = resolveCashInvested(pf);
  const equity = computeEquity(marketValue, loanBalance);
  const monthlyCashFlow = overview.netCashFlow;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashRoi = computeCashOnCashRoiPercent(monthlyCashFlow, cashInvested);
  const grossYield = computeGrossYieldPercent(overview.monthlyIncome, purchasePrice) ?? overview.annualYieldPercent;
  const netYield = computeNetYieldPercent(monthlyCashFlow, purchasePrice);

  const structureTypeId = structureTypeIdFromProperty(pf);
  const totalUnits = effectiveActiveUnitCount(structureTypeId, Number(pf.activeUnitCount) || undefined);
  const leases = params.currentLeases as Record<string, unknown>[];
  const activeLeaseCount = leases.filter((l) =>
    ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? ""))
  ).length;
  const derived = derivePropertyOccupancy({
    structureTypeId,
    investmentType: pf.investmentType as string | undefined,
    activeLeaseCount,
    totalUnitCount: totalUnits
  });

  const stmtSummary = (params.statement?.summary as Record<string, unknown> | undefined) ?? {};
  const occupancyRateRaw = pf.occupancyRate;
  const occupancyRate =
    occupancyRateRaw != null && Number.isFinite(Number(occupancyRateRaw)) ? Number(occupancyRateRaw) : null;

  return {
    propertyId: params.propertyId,
    purchasePrice,
    marketValue,
    loanBalance,
    cashInvested,
    equity,
    monthlyIncome: overview.monthlyIncome,
    monthlyOperatingExpenses: overview.monthlyOperatingExpenses,
    monthlyDebtService: overview.monthlyDebtService,
    monthlyExpenses: overview.totalMonthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCashRoi,
    grossYield,
    netYield,
    occupiedUnits: derived.activeLeaseCount,
    totalUnits: derived.totalUnitCount,
    occupancyRate,
    unitsOccupiedDisplay: formatUnitsOccupiedDisplay(pf, derived.activeLeaseCount, derived.totalUnitCount),
    receivedThisMonth: n(stmtSummary.receivedThisMonth),
    expectedThisMonth: n(stmtSummary.expectedThisMonth),
    overview
  };
}

export type FinancialCompositionSlice = { label: string; amount: number; kind: "income" | "expense" };

/** Income vs expense slices for overview doughnut — derived from the same projected model as Financials. */
export function compositionSlicesFromSummary(summary: PropertyFinancialSummary): FinancialCompositionSlice[] {
  const slices: FinancialCompositionSlice[] = [];
  if (summary.monthlyIncome > 0) {
    slices.push({ label: "Income · Rental & leases", amount: summary.monthlyIncome, kind: "income" });
  }
  for (const cat of summary.overview.expenseCategories) {
    if (cat.amount > 0) {
      slices.push({ label: `Expense · ${cat.label}`, amount: cat.amount, kind: "expense" });
    }
  }
  return slices;
}
