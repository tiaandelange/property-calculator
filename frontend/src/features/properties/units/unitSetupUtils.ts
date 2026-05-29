import { getPropertyTypeConfig, type PropertyTypeConfig } from "../../../config/propertyTypes";
import type { PropertyUnitDraft, UnitRentFrequency } from "./propertyUnitTypes";

export function newClientId(): string {
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultUnitName(cfg: PropertyTypeConfig, index: number, rentBasis?: "room" | "bed"): string {
  const n = index + 1;
  if (cfg.unitMode === "rooms_or_beds" && rentBasis === "bed") return `Bed ${n}`;
  if (cfg.unitMode === "rooms" || cfg.unitMode === "rooms_or_beds") return `Room ${n}`;
  if (cfg.unitLabel === "Main House") return "Main House";
  return `${cfg.unitLabel} ${n}`;
}

export function buildSuggestedUnits(
  cfg: PropertyTypeConfig,
  count: number,
  opts?: { rentBasis?: "room" | "bed"; existing?: PropertyUnitDraft[] }
): PropertyUnitDraft[] {
  const existing = opts?.existing ?? [];
  if (count <= 0) return [];

  const out: PropertyUnitDraft[] = [];
  for (let i = 0; i < count; i++) {
    const prev = existing[i];
    out.push({
      clientId: prev?.clientId ?? newClientId(),
      id: prev?.id,
      unitName: prev?.unitName?.trim() ? prev.unitName : defaultUnitName(cfg, i, opts?.rentBasis),
      unitType: prev?.unitType ?? inferUnitType(cfg, opts?.rentBasis),
      description: prev?.description ?? null,
      bedrooms: prev?.bedrooms ?? null,
      bathrooms: prev?.bathrooms ?? null,
      sizeSqm: prev?.sizeSqm ?? null,
      expectedRent: prev?.expectedRent ?? null,
      rentFrequency: prev?.rentFrequency ?? defaultRentFrequency(cfg, opts?.rentBasis),
      occupancyStatus: prev?.occupancyStatus ?? "vacant",
      sortOrder: i,
      isActive: prev?.isActive ?? true,
      notes: prev?.notes ?? null
    });
  }
  return out;
}

function inferUnitType(cfg: PropertyTypeConfig, rentBasis?: "room" | "bed"): string {
  if (cfg.unitMode === "short_term_unit") return "airbnb_listing";
  if (cfg.unitMode === "rooms_or_beds") return rentBasis === "bed" ? "bed" : "room";
  if (cfg.unitMode === "rooms") return "room";
  if (cfg.unitMode === "single_default_unit") return "main_house";
  if (cfg.id === "duplex") return "unit";
  if (cfg.supportsCommercialLeases) return "office";
  return "unit";
}

function defaultRentFrequency(cfg: PropertyTypeConfig, rentBasis?: "room" | "bed"): UnitRentFrequency {
  if (cfg.unitMode === "short_term_unit") return "nightly";
  if (cfg.unitMode === "rooms_or_beds" && rentBasis === "bed") return "per_bed";
  if (cfg.unitMode === "rooms" || cfg.unitMode === "rooms_or_beds") return "per_room";
  return "monthly";
}

export function unitsForStructureType(
  structureTypeId: string,
  unitCount: number,
  opts?: {
    hasMultipleUnits?: boolean;
    rentBasis?: "room" | "bed";
    existing?: PropertyUnitDraft[];
  }
): PropertyUnitDraft[] {
  const cfg = getPropertyTypeConfig(structureTypeId);

  if (cfg.unitMode === "no_units_by_default") {
    return opts?.hasMultipleUnits ? buildSuggestedUnits(cfg, Math.max(1, unitCount), opts) : [];
  }

  if (cfg.unitMode === "custom") {
    if (!opts?.hasMultipleUnits) return [];
    return buildSuggestedUnits(cfg, Math.max(1, unitCount), opts);
  }

  if (cfg.unitMode === "single_default_unit" || cfg.unitMode === "short_term_unit") {
    const n = cfg.askUnitCount && unitCount > 0 ? unitCount : cfg.defaultUnitCount;
    return buildSuggestedUnits(cfg, Math.max(1, n), opts);
  }

  if (cfg.unitMode === "fixed_units") {
    return buildSuggestedUnits(cfg, cfg.defaultUnitCount, opts);
  }

  if (cfg.askUnitCount) {
    return buildSuggestedUnits(cfg, Math.max(1, unitCount || cfg.defaultUnitCount), opts);
  }

  return buildSuggestedUnits(cfg, cfg.defaultUnitCount, opts);
}

/** Monthly equivalent for property expected income rollup. */
export function unitExpectedRentMonthly(u: PropertyUnitDraft): number {
  if (!u.isActive) return 0;
  const amount = Number(u.expectedRent ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  switch (u.rentFrequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "nightly":
      return amount * 30;
    case "per_room":
    case "per_bed":
    case "monthly":
    default:
      return amount;
  }
}

export function sumUnitsExpectedRentMonthly(units: PropertyUnitDraft[]): number {
  return units.filter((u) => u.isActive).reduce((sum, u) => sum + unitExpectedRentMonthly(u), 0);
}

export function estimateAirbnbMonthlyIncome(form: Record<string, unknown>): number {
  const rate = Number(form.averageDailyRate ?? 0);
  const occ = Number(form.occupancyRate ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const occPct = Number.isFinite(occ) ? Math.min(100, Math.max(0, occ)) / 100 : 0;
  return Math.round(rate * 30 * occPct);
}

export function resolvePropertyExpectedMonthlyIncome(
  form: Record<string, unknown>,
  _units: PropertyUnitDraft[],
  structureTypeId: string
): number | null {
  const cfg = getPropertyTypeConfig(structureTypeId);
  if (cfg.supportsShortTermRentalCosts) {
    const est = estimateAirbnbMonthlyIncome(form);
    return est > 0 ? est : null;
  }
  const manual = Number(form.expectedMonthlyIncome ?? 0);
  return Number.isFinite(manual) && manual > 0 ? manual : null;
}
