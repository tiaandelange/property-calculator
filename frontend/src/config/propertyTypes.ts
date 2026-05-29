/**
 * Property structure types — drives unit generation on Create/Edit Property.
 * Maps to DB `property_type` / `investment_type` enums via `mapStructureTypeToDbFields`.
 */

export type PropertyUnitMode =
  | "single_default_unit"
  | "fixed_units"
  | "dynamic_units"
  | "dynamic_spaces"
  | "rooms"
  | "rooms_or_beds"
  | "short_term_unit"
  | "no_units_by_default"
  | "custom";

export type PropertyFinancialModel = "lease" | "booking" | "holding_costs" | "mixed";

export type PropertyTypeConfig = {
  id: string;
  label: string;
  description: string;
  unitMode: PropertyUnitMode;
  defaultUnitCount: number;
  askUnitCount: boolean;
  unitLabel: string;
  supportsTenants: boolean;
  supportsLeases: boolean;
  supportsBookings: boolean;
  supportsOccupancy: boolean;
  supportsRooms: boolean;
  supportsBeds: boolean;
  supportsCommercialLeases: boolean;
  supportsShortTermRentalCosts: boolean;
  defaultFinancialModel: PropertyFinancialModel;
  /** DB `property_type` enum value */
  dbPropertyType: string;
  /** Suggested `investment_type` when user has not chosen one */
  suggestedInvestmentType?: string;
  requiredFields: string[];
  optionalFields: string[];
};

export const PROPERTY_TYPE_CONFIGS: PropertyTypeConfig[] = [
  {
    id: "single_family_house",
    label: "Single-family house",
    description: "One rentable dwelling — a default main unit is created automatically.",
    unitMode: "single_default_unit",
    defaultUnitCount: 1,
    askUnitCount: false,
    unitLabel: "Main House",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "HOUSE",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: [],
    optionalFields: ["leviesMonthly"]
  },
  {
    id: "duplex",
    label: "Duplex",
    description: "Two side-by-side or stacked units — Unit 1 and Unit 2 are created by default.",
    unitMode: "fixed_units",
    defaultUnitCount: 2,
    askUnitCount: false,
    unitLabel: "Unit",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "DUPLEX",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: [],
    optionalFields: []
  },
  {
    id: "townhouse",
    label: "Townhouse",
    description: "Single townhouse unit with optional body corporate / levies.",
    unitMode: "single_default_unit",
    defaultUnitCount: 1,
    askUnitCount: false,
    unitLabel: "Townhouse",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "TOWNHOUSE",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: [],
    optionalFields: ["leviesMonthly"]
  },
  {
    id: "apartment_flat",
    label: "Apartment / flat",
    description: "Single flat with unit number on the door.",
    unitMode: "single_default_unit",
    defaultUnitCount: 1,
    askUnitCount: false,
    unitLabel: "Flat",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "APARTMENT",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: [],
    optionalFields: ["erfNumber"]
  },
  {
    id: "multi_family",
    label: "Multi-family property",
    description: "Several rentable units in one building — specify how many units to generate.",
    unitMode: "dynamic_units",
    defaultUnitCount: 2,
    askUnitCount: true,
    unitLabel: "Unit",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "HOUSE",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "student_housing",
    label: "Student housing",
    description: "Rent per room or per bed — generate room/bed rows without tenants.",
    unitMode: "rooms_or_beds",
    defaultUnitCount: 4,
    askUnitCount: true,
    unitLabel: "Room",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: true,
    supportsBeds: true,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "ROOM",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: ["unitCount", "rentBasis"],
    optionalFields: []
  },
  {
    id: "rooms_house_share",
    label: "Rooms / house share",
    description: "Shared house with multiple rentable rooms.",
    unitMode: "rooms",
    defaultUnitCount: 3,
    askUnitCount: true,
    unitLabel: "Room",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: true,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "ROOM",
    suggestedInvestmentType: "LONG_TERM_RENTAL",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "airbnb_short_term",
    label: "Airbnb / short-term rental",
    description: "Bookings and occupancy — no tenant assignment during property setup.",
    unitMode: "short_term_unit",
    defaultUnitCount: 1,
    askUnitCount: true,
    unitLabel: "Listing",
    supportsTenants: false,
    supportsLeases: false,
    supportsBookings: true,
    supportsOccupancy: true,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: true,
    defaultFinancialModel: "booking",
    dbPropertyType: "HOUSE",
    suggestedInvestmentType: "SHORT_TERM_RENTAL",
    requiredFields: [],
    optionalFields: ["averageDailyRate", "occupancyRate"]
  },
  {
    id: "mixed_use",
    label: "Mixed-use property",
    description: "Residential and commercial spaces under one title.",
    unitMode: "dynamic_units",
    defaultUnitCount: 2,
    askUnitCount: true,
    unitLabel: "Space",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: true,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "mixed",
    dbPropertyType: "OTHER",
    suggestedInvestmentType: "MIXED_USE",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "commercial",
    label: "Commercial property",
    description: "Commercial rentable spaces.",
    unitMode: "dynamic_spaces",
    defaultUnitCount: 1,
    askUnitCount: true,
    unitLabel: "Space",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: true,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "COMMERCIAL",
    suggestedInvestmentType: "COMMERCIAL",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "office_units",
    label: "Office units",
    description: "Office suites or floors.",
    unitMode: "dynamic_spaces",
    defaultUnitCount: 1,
    askUnitCount: true,
    unitLabel: "Office Suite",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: true,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "COMMERCIAL",
    suggestedInvestmentType: "COMMERCIAL",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "retail_units",
    label: "Retail units",
    description: "Shops or retail bays.",
    unitMode: "dynamic_spaces",
    defaultUnitCount: 1,
    askUnitCount: true,
    unitLabel: "Retail Unit",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: true,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "COMMERCIAL",
    suggestedInvestmentType: "COMMERCIAL",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "industrial_warehouse",
    label: "Industrial / warehouse",
    description: "Warehouses, bays, or industrial units.",
    unitMode: "dynamic_spaces",
    defaultUnitCount: 1,
    askUnitCount: true,
    unitLabel: "Bay",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: true,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "COMMERCIAL",
    suggestedInvestmentType: "COMMERCIAL",
    requiredFields: ["unitCount"],
    optionalFields: []
  },
  {
    id: "vacant_land",
    label: "Vacant land / development",
    description: "Holding costs and valuation — no default rentable units.",
    unitMode: "no_units_by_default",
    defaultUnitCount: 0,
    askUnitCount: false,
    unitLabel: "Parcel",
    supportsTenants: false,
    supportsLeases: false,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "holding_costs",
    dbPropertyType: "OTHER",
    suggestedInvestmentType: "VACANT_LAND",
    requiredFields: [],
    optionalFields: ["landUse", "zoning"]
  },
  {
    id: "other_custom",
    label: "Other / custom",
    description: "Choose whether this asset has rentable units.",
    unitMode: "custom",
    defaultUnitCount: 0,
    askUnitCount: false,
    unitLabel: "Unit",
    supportsTenants: true,
    supportsLeases: true,
    supportsBookings: false,
    supportsOccupancy: false,
    supportsRooms: false,
    supportsBeds: false,
    supportsCommercialLeases: false,
    supportsShortTermRentalCosts: false,
    defaultFinancialModel: "lease",
    dbPropertyType: "OTHER",
    suggestedInvestmentType: "OTHER",
    requiredFields: [],
    optionalFields: []
  }
];

export const PROPERTY_TYPE_CONFIG_BY_ID: Record<string, PropertyTypeConfig> = Object.fromEntries(
  PROPERTY_TYPE_CONFIGS.map((c) => [c.id, c])
);

/** Legacy DB enum → default structure type (edit flow). */
export function legacyPropertyTypeToStructureId(propertyType: string, investmentType: string): string {
  const pt = String(propertyType ?? "").toUpperCase();
  const inv = String(investmentType ?? "").toUpperCase();
  if (inv === "SHORT_TERM_RENTAL") return "airbnb_short_term";
  if (inv === "VACANT_LAND") return "vacant_land";
  if (inv === "MIXED_USE") return "mixed_use";
  if (inv === "COMMERCIAL") return "commercial";
  if (pt === "DUPLEX") return "duplex";
  if (pt === "TOWNHOUSE") return "townhouse";
  if (pt === "APARTMENT") return "apartment_flat";
  if (pt === "ROOM") return "rooms_house_share";
  if (pt === "COMMERCIAL") return "commercial";
  return "single_family_house";
}

export function getPropertyTypeConfig(id: string | undefined | null): PropertyTypeConfig {
  return PROPERTY_TYPE_CONFIG_BY_ID[String(id ?? "single_family_house")] ?? PROPERTY_TYPE_CONFIG_BY_ID.single_family_house;
}

export function mapStructureTypeToDbFields(structureTypeId: string, investmentType?: string): {
  propertyType: string;
  investmentType: string;
} {
  const cfg = getPropertyTypeConfig(structureTypeId);
  const inv = String(investmentType ?? "").toUpperCase();
  const suggested = cfg.suggestedInvestmentType ?? "LONG_TERM_RENTAL";
  return {
    propertyType: cfg.dbPropertyType,
    investmentType: inv || suggested
  };
}
