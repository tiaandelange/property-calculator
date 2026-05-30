import type { PropertyListItem } from "../../services/propertiesSupabase";
import {
  countCurrentLeasesByProperty,
  derivePropertyOccupancy,
  effectiveActiveUnitCount,
  structureTypeIdFromProperty
} from "../../utils/propertyOccupancy";

export const PROPERTIES_DIRECTORY_PAGE_SIZE = 25;

const FINANCIAL_SORTS = new Set([
  "HIGHEST_NOI",
  "HIGHEST_CASH",
  "LOWEST_CASH",
  "URGENT_EXPIRIES",
  "OVERDUE_RENT"
]);

export function needsFinancialSort(sort: string | undefined): boolean {
  return FINANCIAL_SORTS.has(String(sort ?? "RECENT"));
}

export function needsOccupancyAggregateFilter(status: string | undefined): boolean {
  const s = String(status ?? "ALL");
  return s === "OCCUPIED" || s === "PARTIALLY_OCCUPIED" || s === "VACANT";
}

export function investmentTypeSqlFilter(status: string | undefined): string[] | null {
  const s = String(status ?? "ALL");
  if (s === "LAND") return ["VACANT_LAND"];
  if (s === "STR") return ["SHORT_TERM_RENTAL"];
  if (s === "RENOVATION") return ["FLIP", "BRRRR"];
  return null;
}

export function matchesPropertyOccupancyFilter(
  item: Record<string, unknown>,
  status: string | undefined
): boolean {
  const s = String(status ?? "ALL");
  if (s === "ALL") return true;
  const typeKey = String(item.investmentType ?? item.propertyType ?? "");
  if (s === "LAND") return typeKey === "VACANT_LAND";
  if (s === "STR") return typeKey === "SHORT_TERM_RENTAL";
  if (s === "RENOVATION") return typeKey === "FLIP" || typeKey === "BRRRR";
  if (s === "OCCUPIED") return item.occupancyStatus === "OCCUPIED";
  if (s === "PARTIALLY_OCCUPIED") return item.occupancyStatus === "PARTIALLY_OCCUPIED";
  if (s === "VACANT") {
    return item.occupancyStatus === "VACANT" && typeKey !== "VACANT_LAND";
  }
  return true;
}

export function occupancyFromAggregates(
  property: Record<string, unknown>,
  leaseCounts: Map<string, number>,
  unitCounts: Map<string, number>
): string {
  const pid = String(property.id ?? "");
  const structureTypeId = structureTypeIdFromProperty(property);
  const totalUnitCount = effectiveActiveUnitCount(structureTypeId, unitCounts.get(pid));
  const occupancy = derivePropertyOccupancy({
    structureTypeId,
    investmentType: property.investmentType as string | undefined,
    activeLeaseCount: leaseCounts.get(pid) ?? 0,
    totalUnitCount
  });
  return occupancy.code;
}

export function sortPropertyDirectoryItems(
  items: PropertyListItem[],
  sort: string | undefined
): PropertyListItem[] {
  const next = [...items];
  const asNum = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const equity = (p: PropertyListItem) => {
    const v = asNum(p.currentEstimatedValue);
    const b = asNum(p.outstandingBondBalance);
    return v != null && b != null ? v - b : null;
  };
  const cashFlow = (p: PropertyListItem) => Number(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow ?? 0);
  const noi = (p: PropertyListItem) => Number(p.monthlyNOI ?? 0);
  const leaseEnd = (p: PropertyListItem) => {
    const cl = p.currentLeases as Array<{ fixedTermEndDate?: string }> | undefined;
    const end = cl?.[0]?.fixedTermEndDate ?? (p as { currentLease?: { fixedTermEndDate?: string } }).currentLease?.fixedTermEndDate;
    return end ? new Date(end).getTime() : Infinity;
  };

  switch (sort) {
    case "HIGHEST_NOI":
      next.sort((a, b) => noi(b) - noi(a));
      break;
    case "HIGHEST_EQUITY":
      next.sort((a, b) => (equity(b) ?? -Infinity) - (equity(a) ?? -Infinity));
      break;
    case "HIGHEST_CASH":
      next.sort((a, b) => cashFlow(b) - cashFlow(a));
      break;
    case "LOWEST_CASH":
      next.sort((a, b) => cashFlow(a) - cashFlow(b));
      break;
    case "URGENT_EXPIRIES":
      next.sort((a, b) => leaseEnd(a) - leaseEnd(b));
      break;
    case "OVERDUE_RENT":
      next.sort((a, b) => Number(Boolean(b.rentOverdue)) - Number(Boolean(a.rentOverdue)));
      break;
    case "RECENT":
    default:
      next.sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime());
      break;
  }
  return next;
}
