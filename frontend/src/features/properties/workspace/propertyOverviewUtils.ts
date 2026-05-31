import { PROPERTY_TYPE_LABELS } from "../form/propertyFormConstants";
import type { StatusTone } from "../../../components/ui/DashboardKit";

export function formatOverviewCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `R ${Math.round(value).toLocaleString()}`;
}

export function formatOverviewPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function buildPropertyAddress(data: Record<string, unknown>): string {
  const parts = [data.addressLine1, data.suburb, data.city, data.province].filter(Boolean).map(String);
  return parts.join(", ");
}

export function propertyDescription(data: Record<string, unknown>): string | null {
  const notes = data.notes;
  if (notes == null) return null;
  const text = String(notes).trim();
  return text || null;
}

export function propertyTypeLabel(data: Record<string, unknown>): string {
  const propertyType = data.propertyType != null ? String(data.propertyType) : "";
  if (propertyType && PROPERTY_TYPE_LABELS[propertyType]) return PROPERTY_TYPE_LABELS[propertyType];
  const inv = data.investmentType != null ? String(data.investmentType) : "";
  const invMap: Record<string, string> = {
    LONG_TERM_RENTAL: "Long-term rental",
    SHORT_TERM_RENTAL: "Short-term rental",
    VACANT_LAND: "Vacant land",
    BRRRR: "BRRRR",
    FLIP: "Flip",
    PRIMARY_RESIDENCE: "Primary residence",
    COMMERCIAL: "Commercial",
    HOUSE_HACK: "House hack",
    MIXED_USE: "Mixed use",
    OTHER: "Other"
  };
  return invMap[inv] ?? invMap.OTHER;
}

export type PropertyStatusDisplay = {
  label: string;
  tone: StatusTone;
};

export function propertyStatusDisplay(data: Record<string, unknown>): PropertyStatusDisplay {
  const rawStatus = data.status != null ? String(data.status).toUpperCase() : "";
  if (rawStatus === "ARCHIVED") return { label: "Inactive", tone: "default" };
  if (rawStatus === "DRAFT") return { label: "Inactive", tone: "default" };

  const inv = data.investmentType != null ? String(data.investmentType) : "";
  if (inv === "FLIP") return { label: "Under Maintenance", tone: "info" };

  const occupancy = data.occupancyStatus != null ? String(data.occupancyStatus).toUpperCase() : "";
  if (occupancy === "OCCUPIED") return { label: "Occupied", tone: "success" };
  if (occupancy === "PARTIALLY_OCCUPIED") return { label: "Partially Occupied", tone: "warning" };
  if (inv === "VACANT_LAND") return { label: "Vacant", tone: "default" };
  return { label: "Vacant", tone: "warning" };
}

export function unitsOccupiedLabel(data: Record<string, unknown>, currentLeases: unknown[]): string {
  const inv = data.investmentType != null ? String(data.investmentType) : "";
  const totalUnits = Math.max(1, Number(data.activeUnitCount ?? 1) || 1);
  const occupied = Number(data.leasedUnitCount ?? currentLeases.length) || 0;

  if (inv === "SHORT_TERM_RENTAL") {
    const rate = data.occupancyRate;
    if (rate != null && !Number.isNaN(Number(rate))) {
      return `${Math.round(Number(rate) * (Number(rate) <= 1 ? 100 : 1))}%`;
    }
  }

  if (totalUnits <= 1) {
    return occupied > 0 ? "1 / 1" : "0 / 1";
  }

  return `${occupied} / ${totalUnits}`;
}

export function formatLastUpdated(data: Record<string, unknown>): string | null {
  const raw = data.updatedAt ?? data.updated_at ?? data.createdAt ?? data.created_at;
  if (!raw) return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
