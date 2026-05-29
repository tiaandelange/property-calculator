export type UnitOccupancyStatus =
  | "vacant"
  | "occupied"
  | "unavailable"
  | "owner_occupied"
  | "under_maintenance"
  | "inactive";

export type UnitRentFrequency = "monthly" | "weekly" | "nightly" | "per_room" | "per_bed";

export type PropertyUnitDraft = {
  /** Client id for unsaved rows */
  clientId: string;
  /** Persisted uuid when loaded from DB */
  id?: string;
  unitName: string;
  unitType?: string | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqm?: number | null;
  expectedRent?: number | null;
  rentFrequency: UnitRentFrequency;
  occupancyStatus: UnitOccupancyStatus;
  sortOrder: number;
  isActive: boolean;
  notes?: string | null;
};

export const UNIT_OCCUPANCY_OPTIONS: { value: UnitOccupancyStatus; label: string }[] = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "unavailable", label: "Unavailable" },
  { value: "owner_occupied", label: "Owner occupied" },
  { value: "under_maintenance", label: "Under maintenance" },
  { value: "inactive", label: "Inactive" }
];

export const UNIT_RENT_FREQUENCY_OPTIONS: { value: UnitRentFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "nightly", label: "Nightly" },
  { value: "per_room", label: "Per room" },
  { value: "per_bed", label: "Per bed" }
];

export const UNIT_USE_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Other" }
] as const;
