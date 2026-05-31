export const BOND_TERM_YEAR_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export const MAX_PROPERTY_PHOTOS = 5;
/** Combined size budget for all property photos on create/edit. */
export const MAX_PROPERTY_PHOTOS_TOTAL_BYTES = 5 * 1024 * 1024;

export function formatPropertyPhotosTotalLimit(): string {
  return "5 MB total";
}

export const PROPERTY_TYPE_OPTIONS = [
  { value: "HOUSE", label: "House" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "DUPLEX", label: "Duplex" },
  { value: "ROOM", label: "Room" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OTHER", label: "Other" }
] as const;

export const INVESTMENT_TYPE_OPTIONS = [
  { value: "LONG_TERM_RENTAL", label: "Long-Term Rental" },
  { value: "SHORT_TERM_RENTAL", label: "Airbnb / Short-Term Rental" },
  { value: "PRIMARY_RESIDENCE", label: "Primary Residence" },
  { value: "HOUSE_HACK", label: "House Hack" },
  { value: "BRRRR", label: "BRRRR Property" },
  { value: "FLIP", label: "Flip / Renovation Project" },
  { value: "VACANT_LAND", label: "Vacant Land" },
  { value: "COMMERCIAL", label: "Commercial Property" },
  { value: "MIXED_USE", label: "Mixed Use" },
  { value: "OTHER", label: "Other" }
] as const;

export const INVESTMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  INVESTMENT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export const PROPERTY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export const STATUS_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "FOR_RENT", label: "For Rent" },
  { value: "FOR_SALE", label: "For Sale" },
  { value: "ARCHIVED", label: "Archived" }
] as const;

export const STATUS_HELPERS: Record<string, string> = {
  ACTIVE: "Ready to rent",
  DRAFT: "Draft listing",
  FOR_RENT: "Available for tenants",
  FOR_SALE: "Listed for sale",
  ARCHIVED: "Archived property",
  "": "Set listing status"
};

export type PropertyFormMode = "create" | "edit";

export type PropertyFormValues = Record<string, unknown>;
