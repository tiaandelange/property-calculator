import { getPropertyTypeConfig, legacyPropertyTypeToStructureId } from "../config/propertyTypes";
import { isCurrentLeaseStatus, leaseDisplayStatus } from "./leaseDisplay";

export type PropertyOccupancyCode = "VACANT" | "OCCUPIED" | "PARTIALLY_OCCUPIED";

export type PropertyOccupancyResult = {
  code: PropertyOccupancyCode;
  label: string;
  activeLeaseCount: number;
  totalUnitCount: number;
};

/** Rentable units for occupancy math (saved rows, else structure defaults). */
export function effectiveActiveUnitCount(
  structureTypeId: string | null | undefined,
  savedActiveUnitCount?: number | null
): number {
  if (savedActiveUnitCount != null && savedActiveUnitCount > 0) return savedActiveUnitCount;
  const cfg = getPropertyTypeConfig(structureTypeId);
  if (cfg.unitMode === "no_units_by_default") return 0;
  if (
    cfg.unitMode === "fixed_units" ||
    cfg.unitMode === "single_default_unit" ||
    cfg.unitMode === "short_term_unit"
  ) {
    return cfg.defaultUnitCount;
  }
  return 1;
}

/**
 * Occupancy is derived from active leases vs unit count — not user-edited on unit rows.
 * Single-unit properties never show "partially rented".
 */
export function derivePropertyOccupancy(params: {
  structureTypeId?: string | null;
  investmentType?: string | null;
  activeLeaseCount: number;
  totalUnitCount: number;
}): PropertyOccupancyResult {
  const { activeLeaseCount } = params;
  const structureTypeId = params.structureTypeId ?? "single_family_house";
  const totalUnitCount = Math.max(0, params.totalUnitCount);
  const cfg = getPropertyTypeConfig(structureTypeId);
  const isSingleUnit =
    cfg.unitMode === "single_default_unit" ||
    cfg.unitMode === "short_term_unit" ||
    structureTypeId === "single_family_house" ||
    totalUnitCount <= 1;

  if (activeLeaseCount <= 0) {
    return { code: "VACANT", label: "Vacant", activeLeaseCount: 0, totalUnitCount };
  }

  if (isSingleUnit) {
    return { code: "OCCUPIED", label: "Occupied", activeLeaseCount, totalUnitCount: Math.max(1, totalUnitCount) };
  }

  if (activeLeaseCount >= totalUnitCount) {
    return { code: "OCCUPIED", label: "Occupied", activeLeaseCount, totalUnitCount };
  }

  return {
    code: "PARTIALLY_OCCUPIED",
    label: "Partially rented",
    activeLeaseCount,
    totalUnitCount
  };
}

export function structureTypeIdFromProperty(row: Record<string, unknown>): string {
  const explicit = row.structureTypeId ?? row.structure_type_id;
  if (explicit != null && String(explicit).trim()) return String(explicit);
  return legacyPropertyTypeToStructureId(String(row.propertyType ?? ""), String(row.investmentType ?? ""));
}

export function occupancyCodeToTenantStatus(code: PropertyOccupancyCode): string {
  if (code === "OCCUPIED") return "Occupied";
  if (code === "PARTIALLY_OCCUPIED") return "Partially rented";
  return "Vacant";
}

/** Count current (active / month-to-month) leases per property for list enrichment. */
export function countCurrentLeasesByProperty(
  leaseRows: { property_id?: unknown; status?: unknown; fixed_term_end_date?: unknown }[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of leaseRows) {
    const pid = row.property_id != null ? String(row.property_id) : "";
    if (!pid) continue;
    const display = leaseDisplayStatus({
      status: String(row.status ?? ""),
      fixedTermEndDate: row.fixed_term_end_date as string | null | undefined
    });
    if (!isCurrentLeaseStatus(display)) continue;
    out.set(pid, (out.get(pid) ?? 0) + 1);
  }
  return out;
}
