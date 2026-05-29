import { getPropertyTypeConfig, legacyPropertyTypeToStructureId } from "../../../config/propertyTypes";
import type { PropertyUnitDraft } from "../units/propertyUnitTypes";
import { unitExpectedRentMonthly } from "../units/unitSetupUtils";
import type { TenantUnitLinkRecord } from "./tenantUnitLinkTypes";

export function structureTypeIdFromPropertyRow(row: Record<string, unknown>): string {
  const explicit = row.structureTypeId ?? row.structure_type_id;
  if (explicit != null && String(explicit).trim()) return String(explicit);
  return legacyPropertyTypeToStructureId(String(row.propertyType ?? ""), String(row.investmentType ?? ""));
}

export function isShortTermRentalProperty(row: Record<string, unknown>): boolean {
  return String(row.investmentType ?? "").toUpperCase() === "SHORT_TERM_RENTAL";
}

export function isVacantLandWithoutUnits(row: Record<string, unknown>, units: PropertyUnitDraft[]): boolean {
  const inv = String(row.investmentType ?? "").toUpperCase();
  if (inv !== "VACANT_LAND") return false;
  return units.filter((u) => u.isActive !== false).length === 0;
}

export function shouldShowTenantLinking(row: Record<string, unknown>, units: PropertyUnitDraft[]): boolean {
  if (isShortTermRentalProperty(row)) return false;
  if (isVacantLandWithoutUnits(row, units)) return false;
  return true;
}

/** Unit rent counted once per unit — never multiplied by tenant count. */
export function unitExpectedRentDisplay(unit: PropertyUnitDraft): number {
  return unitExpectedRentMonthly(unit);
}

export function sumExpectedRentForUnits(units: PropertyUnitDraft[]): number {
  return units.filter((u) => u.isActive !== false).reduce((sum, u) => sum + unitExpectedRentDisplay(u), 0);
}

export function activeLinksForUnit(links: TenantUnitLinkRecord[], unitId: string | null): TenantUnitLinkRecord[] {
  return links.filter((l) => l.status === "active" && (l.unitId ?? null) === (unitId ?? null));
}

export function unitOccupancyLabel(links: TenantUnitLinkRecord[], unitId: string | null, unit?: PropertyUnitDraft): string {
  if (unit?.occupancyStatus === "unavailable" || unit?.occupancyStatus === "under_maintenance") return "Unavailable";
  const active = activeLinksForUnit(links, unitId);
  return active.length > 0 ? "Occupied" : "Vacant";
}

export function isSingleUnitProperty(structureTypeId: string, units: PropertyUnitDraft[]): boolean {
  const cfg = getPropertyTypeConfig(structureTypeId);
  const active = units.filter((u) => u.isActive !== false);
  return cfg.unitMode === "single_default_unit" || active.length <= 1;
}

export function displayUnitsForLinking(structureTypeId: string, units: PropertyUnitDraft[]): PropertyUnitDraft[] {
  const active = units.filter((u) => u.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder);
  if (active.length > 0) return active;
  const cfg = getPropertyTypeConfig(structureTypeId);
  if (cfg.unitMode === "no_units_by_default") return [];
  if (cfg.defaultUnitCount <= 0) return [];
  return [
    {
      clientId: "virtual-main",
      unitName: cfg.unitLabel === "Main House" ? "Main House" : cfg.unitLabel,
      rentFrequency: "monthly",
      occupancyStatus: "vacant",
      sortOrder: 0,
      isActive: true
    }
  ];
}
