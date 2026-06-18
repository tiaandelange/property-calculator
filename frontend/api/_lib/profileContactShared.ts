/**
 * Personal profile + business details — shared by Settings UI and invoice PDF generation.
 */

export type NormalizedProfileDetails = {
  phone: string;
  address: string;
  avatarStorageKey: string;
  avatarIcon: string;
};

export type NormalizedBusinessDetails = {
  businessName: string;
  landlordName: string;
  email: string;
  phone: string;
  address: string;
};

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

export function normalizeProfileDetails(raw: unknown): NormalizedProfileDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { phone: "", address: "", avatarStorageKey: "", avatarIcon: "property" };
  }
  const d = raw as Record<string, unknown>;
  const icon = str(d.avatarIcon ?? d.avatar_icon) || "property";
  return {
    phone: str(d.phone ?? d.cell ?? d.cellNumber ?? d.cell_number),
    address: str(d.address),
    avatarStorageKey: str(d.avatarStorageKey ?? d.avatar_storage_key),
    avatarIcon: icon
  };
}

export function normalizeBusinessDetails(raw: unknown, legacyPaymentRaw?: unknown): NormalizedBusinessDetails {
  const empty = (): NormalizedBusinessDetails => ({
    businessName: "",
    landlordName: "",
    email: "",
    phone: "",
    address: ""
  });

  let base = empty();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const d = raw as Record<string, unknown>;
    base = {
      businessName: str(d.businessName ?? d.business_name),
      landlordName: str(d.landlordName ?? d.landlord_name),
      email: str(d.email),
      phone: str(d.phone ?? d.cell ?? d.cellNumber ?? d.cell_number),
      address: str(d.address)
    };
  }

  if (legacyPaymentRaw && typeof legacyPaymentRaw === "object" && !Array.isArray(legacyPaymentRaw)) {
    const leg = legacyPaymentRaw as Record<string, unknown>;
    if (!base.phone) base.phone = str(leg.businessPhone ?? leg.business_phone);
    if (!base.address) base.address = str(leg.businessAddress ?? leg.business_address);
  }

  return base;
}

export type FinancialLandlordParty = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

/** Landlord block for invoices/PDFs based on settings toggle. */
export function resolveFinancialLandlordParty(opts: {
  useBusinessForFinancials: boolean;
  fullName: string | null | undefined;
  authEmail: string | null | undefined;
  profileDetails: NormalizedProfileDetails;
  businessDetails: NormalizedBusinessDetails;
  invoiceCcEmail?: string;
}): FinancialLandlordParty {
  const loginEmail = str(opts.authEmail);
  const displayName = str(opts.fullName) || "Proplytic";

  if (opts.useBusinessForFinancials) {
    const b = opts.businessDetails;
    const name = str(b.businessName) || str(b.landlordName) || displayName;
    const email = str(b.email) || loginEmail || str(opts.invoiceCcEmail);
    return {
      name,
      email: email || undefined,
      phone: str(b.phone) || undefined,
      address: str(b.address) || undefined
    };
  }

  const p = opts.profileDetails;
  return {
    name: displayName,
    email: loginEmail || str(opts.invoiceCcEmail) || undefined,
    phone: str(p.phone) || undefined,
    address: str(p.address) || undefined
  };
}

export function profileDetailsToPayload(details: NormalizedProfileDetails): Record<string, string> {
  return {
    phone: details.phone,
    address: details.address,
    avatarStorageKey: details.avatarStorageKey,
    avatarIcon: details.avatarIcon
  };
}

/** Display name for invoices/emails from a loaded Me profile. */
export function financialDisplayNameFromProfile(opts: {
  name?: string | null;
  email?: string;
  financialLandlord?: FinancialLandlordParty;
}): string {
  return opts.financialLandlord?.name?.trim() || opts.name?.trim() || opts.email?.trim() || "Proplytic";
}

export function businessDetailsToPayload(details: NormalizedBusinessDetails): Record<string, string> {
  return {
    businessName: details.businessName,
    landlordName: details.landlordName,
    email: details.email,
    phone: details.phone,
    address: details.address
  };
}
