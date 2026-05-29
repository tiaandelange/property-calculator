import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import { snakeRowToCamel } from "../api/propertyRowMapping";
import { dbToLease } from "../api/leaseRowMapping";
import { isCurrentLeaseStatus } from "../utils/leaseDisplay";
import {
  derivePropertyOccupancy,
  effectiveActiveUnitCount,
  occupancyCodeToTenantStatus,
  structureTypeIdFromProperty
} from "../utils/propertyOccupancy";

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
}

function ymNowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isValidDayOfMonth(d: number): boolean {
  return Number.isInteger(d) && d >= 1 && d <= 31;
}

const LEASE_SELECT = `
  *,
  tenants (*),
  lease_tenants (
    id,
    tenant_id,
    role,
    is_primary,
    tenants ( id, first_name, last_name, email, phone, status )
  )
`;

const LEASE_DIRECTORY_SELECT = `
  *,
  tenants ( id, first_name, last_name, email, phone ),
  properties ( id, name, address_line1, address_line2, suburb, city )
`;

export type PropertyLeasesBundle = {
  currentLeases: Record<string, unknown>[];
  currentLease: Record<string, unknown> | null;
  historicalLeases: Record<string, unknown>[];
  leases: Record<string, unknown>[];
  historicalLeaseSummaries: Record<string, unknown>[];
};

function buildLeaseBundle(leases: Record<string, unknown>[]): PropertyLeasesBundle {
  const currentLeases = leases.filter((l) => isCurrentLeaseStatus(String(l.displayStatus ?? l.status ?? "")));
  const currentLease = currentLeases[0] ?? null;
  const historicalLeases = leases.filter((l) => !isCurrentLeaseStatus(String(l.displayStatus ?? l.status ?? "")));
  const historicalLeaseSummaries = historicalLeases.map((l) => {
    const t = l.tenant as Record<string, unknown> | null | undefined;
    const tenantLabel =
      t && typeof t === "object" ? `${String(t.firstName ?? "")} ${String(t.lastName ?? "")}`.trim() || null : null;
    return {
      id: l.id,
      displayStatus: l.displayStatus,
      startDate: l.startDate,
      fixedTermEndDate: l.fixedTermEndDate,
      tenantLabel
    };
  });
  return { currentLeases, currentLease, historicalLeases, leases, historicalLeaseSummaries };
}

/** All leases for the signed-in user (directory / leases page). */
export async function listLeasesDirectoryRows(): Promise<Record<string, unknown>[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leases")
    .select(LEASE_DIRECTORY_SELECT)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((row) => dbToLease(row as Record<string, unknown>));
}

/** Same envelope as `GET /api/properties/:propertyId/leases`. RLS enforces ownership. */
export async function listLeasesForProperty(propertyId: string | number): Promise<PropertyLeasesBundle> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leases")
    .select(LEASE_SELECT)
    .eq("property_id", String(propertyId))
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  const leases = (data ?? []).map((r) => dbToLease(r as Record<string, unknown>));
  return buildLeaseBundle(leases);
}

/** Same envelope as `GET /api/properties/:propertyId/current-lease`. */
export async function getCurrentLease(propertyId: string | number): Promise<{
  currentLeases: Record<string, unknown>[];
  currentLease: Record<string, unknown> | null;
}> {
  const { currentLeases, currentLease } = await listLeasesForProperty(propertyId);
  return { currentLeases, currentLease };
}

function mapRpcExceptionMessage(code: string): string {
  const map: Record<string, string> = {
    TENANT_HAS_ACTIVE_LEASE: "This tenant already has a current lease. Cancel the existing lease before creating a new one.",
    NOT_AUTHENTICATED: "Not signed in.",
    PROPERTY_NOT_FOUND: "Property not found",
    INVALID_TENANT: "Invalid tenant",
    INVALID_UNIT: "Invalid unit for this property.",
    MISSING_PROPERTY_OR_TENANT: "tenantId and property are required.",
    NEGATIVE_AMOUNT: "Amounts must be non-negative.",
    INVALID_RENT_DUE_DAY: "rentDueDay must be between 1 and 31",
    FIXED_TERM_END_REQUIRED: "Fixed term end date is required for fixed-term leases.",
    FIXED_TERM_END_AFTER_START: "fixedTermEndDate must be after startDate",
    LEASE_NOT_FOUND: "Lease not found",
    LEASE_ALREADY_CLOSED: "Lease already cancelled/terminated",
    CANCELLATION_DATE_REQUIRED: "cancellationDate is required (YYYY-MM-DD)"
  };
  return map[code] ?? code;
}

function throwMappedRpcError(raw: string): never {
  const code = raw.includes(" — ") ? raw.split(" — ")[0]! : raw;
  const msg = mapRpcExceptionMessage(code.trim());
  const err = new Error(msg);
  (err as Error & { code?: string }).code = code.trim();
  throw err;
}

function buildLeaseSnakePatch(input: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.monthlyRent != null) patch.monthly_rent = Number(input.monthlyRent);
  if (input.depositAmount != null) {
    patch.deposit_amount = Number(input.depositAmount);
    patch.deposit_growth_last_applied_month = ymNowLocal();
  }
  if (Object.prototype.hasOwnProperty.call(input, "depositAnnualGrowthPercent")) {
    const raw = input.depositAnnualGrowthPercent;
    if (raw === null || raw === "") {
      patch.deposit_annual_growth_percent = null;
      patch.deposit_growth_last_applied_month = null;
    } else {
      const p = Number(raw);
      if (Number.isNaN(p) || p < 0 || p > 100) {
        throw new Error("depositAnnualGrowthPercent must be between 0 and 100");
      }
      if (p === 0) {
        patch.deposit_annual_growth_percent = null;
        patch.deposit_growth_last_applied_month = null;
      } else {
        patch.deposit_annual_growth_percent = p;
        patch.deposit_growth_last_applied_month = ymNowLocal();
      }
    }
  }
  if (input.rentDueDay != null) {
    const d = Number(input.rentDueDay);
    if (!isValidDayOfMonth(d)) throw new Error("rentDueDay must be between 1 and 31");
    patch.rent_due_day = d;
  }
  if (input.startDate) patch.start_date = input.startDate;
  if (Object.prototype.hasOwnProperty.call(input, "fixedTermEndDate")) {
    patch.fixed_term_end_date = input.fixedTermEndDate ? input.fixedTermEndDate : null;
  }
  if (input.leaseType) patch.lease_type = input.leaseType;
  if (Object.prototype.hasOwnProperty.call(input, "notes")) patch.notes = input.notes ?? null;

  return patch;
}

/** Active leases with lease_tenants for property occupancy display. */
export type ActiveLeaseOccupancy = {
  leaseId: string;
  unitId: string | null;
  monthlyRent: number;
  displayStatus: string;
  startDate?: string;
  fixedTermEndDate?: string | null;
  tenants: Array<{
    tenantId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    role: string;
    isPrimary: boolean;
  }>;
};

export async function listActiveLeaseOccupancyForProperty(propertyId: string | number): Promise<ActiveLeaseOccupancy[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leases")
    .select(LEASE_SELECT)
    .eq("user_id", uid)
    .eq("property_id", String(propertyId))
    .order("created_at", { ascending: false });
  if (error) throw toError(error);

  return (data ?? [])
    .map((row) => dbToLease(row as Record<string, unknown>))
    .filter((l) => isCurrentLeaseStatus(String(l.displayStatus ?? l.status ?? "")))
    .map((l) => {
      const leaseTenants = Array.isArray(l.leaseTenants) ? l.leaseTenants : [];
      const tenants = leaseTenants.map((lt: Record<string, unknown>) => {
        const t = (lt.tenant ?? {}) as Record<string, unknown>;
        return {
          tenantId: String(lt.tenantId ?? t.id ?? ""),
          firstName: String(t.firstName ?? ""),
          lastName: String(t.lastName ?? ""),
          email: t.email != null ? String(t.email) : null,
          role: String(lt.role ?? "occupant"),
          isPrimary: lt.isPrimary === true
        };
      });
      if (!tenants.length && l.tenant && typeof l.tenant === "object") {
        const t = l.tenant as Record<string, unknown>;
        tenants.push({
          tenantId: String(l.tenantId ?? t.id ?? ""),
          firstName: String(t.firstName ?? ""),
          lastName: String(t.lastName ?? ""),
          email: t.email != null ? String(t.email) : null,
          role: "primary_tenant",
          isPrimary: true
        });
      }
      return {
        leaseId: String(l.id),
        unitId: l.unitId != null ? String(l.unitId) : null,
        monthlyRent: Number(l.monthlyRent ?? 0),
        displayStatus: String(l.displayStatus ?? l.status ?? ""),
        startDate: l.startDate != null ? String(l.startDate) : undefined,
        fixedTermEndDate: l.fixedTermEndDate != null ? String(l.fixedTermEndDate) : null,
        tenants
      };
    });
}

/** Atomic create (lease + lease_tenants + optional rent rule) via `public.create_property_lease`. */
export async function createLease(propertyId: string | number, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const payload = {
    ...input,
    propertyId: String(propertyId)
  };
  const { data, error } = await sb.rpc("create_property_lease", { p_payload: payload });
  if (error) {
    const raw = error.message ?? "";
    if (
      raw.includes("TENANT_HAS_ACTIVE_LEASE") ||
      raw.includes("PROPERTY_NOT_FOUND") ||
      raw.includes("INVALID_TENANT") ||
      raw.includes("INVALID_UNIT") ||
      raw.includes("FIXED_TERM") ||
      raw.includes("NEGATIVE_AMOUNT") ||
      raw.includes("INVALID_RENT_DUE_DAY") ||
      raw.includes("MISSING_PROPERTY_OR_TENANT")
    ) {
      throwMappedRpcError(raw);
    }
    throw toError(error);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return dbToLease(row);
}

/**
 * Updates a lease and syncs the linked recurring rent rule (Express parity).
 * Not atomic across statements; lease row is authoritative if a later step fails.
 */
export async function updateLease(id: string | number, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const lid = String(id);

  const { data: existingRow, error: exErr } = await sb
    .from("leases")
    .select("*")
    .eq("id", lid)
    .eq("user_id", uid)
    .maybeSingle();
  if (exErr) throw toError(exErr);
  if (!existingRow) throw new Error("Lease not found.");

  const existing = snakeRowToCamel(existingRow as Record<string, unknown>) as Record<string, unknown>;
  const st = String(existing.status ?? "");
  if (st === "CANCELLED" || st === "TERMINATED") {
    throw new Error("Cannot edit a cancelled/terminated lease.");
  }

  const { count: invCount, error: invErr } = await sb
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", lid)
    .eq("user_id", uid);
  if (invErr) throw toError(invErr);

  const { count: incCount, error: incErr } = await sb
    .from("income_entries")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", lid)
    .eq("user_id", uid);
  if (incErr) throw toError(incErr);

  const hasLinks = (invCount ?? 0) > 0 || (incCount ?? 0) > 0;
  if (st === "ARCHIVED" && hasLinks) {
    throw new Error("Cannot edit an archived lease that has linked invoices/income entries.");
  }

  const patch = buildLeaseSnakePatch(input);
  if (Object.keys(patch).length === 0) {
    const { data: cur, error: curErr } = await sb.from("leases").select(LEASE_SELECT).eq("id", lid).eq("user_id", uid).single();
    if (curErr) throw toError(curErr);
    return dbToLease(cur as Record<string, unknown>);
  }

  const { data: updatedRow, error: upErr } = await sb
    .from("leases")
    .update(patch)
    .eq("id", lid)
    .eq("user_id", uid)
    .select(LEASE_SELECT)
    .single();
  if (upErr) throw toError(upErr);

  const rulePatch: Record<string, unknown> = {};
  if (patch.monthly_rent != null) rulePatch.amount = patch.monthly_rent;
  if (patch.rent_due_day != null) rulePatch.day_of_month = patch.rent_due_day;
  if (patch.start_date != null || Object.prototype.hasOwnProperty.call(patch, "fixed_term_end_date")) {
    if (patch.start_date != null) rulePatch.start_date = patch.start_date;
    rulePatch.end_date = Object.prototype.hasOwnProperty.call(patch, "fixed_term_end_date")
      ? patch.fixed_term_end_date
      : (existingRow as { fixed_term_end_date?: unknown }).fixed_term_end_date ?? null;
  }

  if (Object.keys(rulePatch).length > 0) {
    const { error: rErr } = await sb.from("recurring_income_rules").update(rulePatch).eq("lease_id", lid).eq("user_id", uid);
    if (rErr) throw toError(rErr);
  }

  return dbToLease(updatedRow as Record<string, unknown>);
}

/** Permanently deletes a lease and all attached invoices/income (via `public.hard_delete_lease`). */
export async function hardDeleteLease(id: string | number): Promise<{ message: string }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const lid = String(id);

  const { data: invoiceRows, error: invListErr } = await sb
    .from("invoices")
    .select("id, pdf_storage_bucket, pdf_storage_key")
    .eq("lease_id", lid)
    .eq("user_id", uid);
  if (invListErr) throw toError(invListErr);

  for (const row of invoiceRows ?? []) {
    const r = row as { pdf_storage_bucket?: string | null; pdf_storage_key?: string | null };
    if (r.pdf_storage_key && r.pdf_storage_bucket) {
      await sb.storage.from(String(r.pdf_storage_bucket)).remove([String(r.pdf_storage_key)]);
    }
  }

  const { data, error } = await sb.rpc("hard_delete_lease", { p_lease_id: lid });
  if (error) {
    const raw = error.message ?? "";
    if (raw.includes("LEASE_NOT_FOUND")) throw new Error("Lease not found");
    throw toError(error);
  }
  const out = (data ?? {}) as Record<string, unknown>;
  return { message: String(out.message ?? "Lease permanently deleted") };
}

/** Draft hard-delete or archive + cancel rent rules (via `public.delete_or_archive_lease`). */
export async function deleteOrArchiveLease(id: string | number): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("delete_or_archive_lease", { p_lease_id: String(id) });
  if (error) {
    const raw = error.message ?? "";
    if (raw.includes("LEASE_NOT_FOUND")) throw new Error("Lease not found");
    throw toError(error);
  }
  const out = (data ?? {}) as Record<string, unknown>;
  if (out.deleted === true) {
    return { message: String(out.message ?? "Deleted draft lease") };
  }
  const leaseRaw = out.lease as Record<string, unknown> | undefined;
  return {
    message: String(out.message ?? "Archived lease"),
    lease: leaseRaw ? dbToLease(leaseRaw) : undefined
  };
}

/** Cancel lease (RPC `public.cancel_lease`): rules, future expected income, tenant if last active. */
export async function cancelLease(id: string | number, payload: Record<string, unknown>): Promise<{ lease: Record<string, unknown> }> {
  await requireUserId();
  const sb = getSupabase();
  const cancellationDate = payload.cancellationDate;
  if (cancellationDate == null || String(cancellationDate).trim() === "") {
    throw new Error("cancellationDate is required (YYYY-MM-DD)");
  }
  const dateStr = String(cancellationDate).slice(0, 10);
  const { data, error } = await sb.rpc("cancel_lease", {
    p_lease_id: String(id),
    p_cancellation_date: dateStr,
    p_cancellation_reason: payload.cancellationReason != null ? String(payload.cancellationReason) : null,
    p_cancelled_by: payload.cancelledBy != null ? String(payload.cancelledBy) : null
  });
  if (error) {
    const raw = error.message ?? "";
    if (raw.includes("LEASE_NOT_FOUND")) throw new Error("Lease not found");
    if (raw.includes("LEASE_ALREADY_CLOSED")) throw new Error("Lease already cancelled/terminated");
    if (raw.includes("CANCELLATION_DATE_REQUIRED")) throw new Error("cancellationDate is required (YYYY-MM-DD)");
    throw toError(error);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return { lease: dbToLease(row) };
}

/** Merges `listLeasesForProperty` output into a property detail record from `propertiesSupabase.getProperty`. */
export function mergeLeaseBundleIntoPropertyDetail(
  base: Record<string, unknown>,
  bundle: PropertyLeasesBundle,
  opts?: { activeUnitCount?: number }
): Record<string, unknown> {
  const meta = (base.aggregateMeta as Record<string, unknown> | undefined) ?? {};
  const counts = (meta.counts as Record<string, unknown> | undefined) ?? {};
  const combined = bundle.currentLeases.reduce((a, l) => a + Number((l as { monthlyRent?: number }).monthlyRent ?? 0), 0);
  const leaseDisplayStatus =
    bundle.currentLease != null ? String((bundle.currentLease as { displayStatus?: string }).displayStatus ?? "ACTIVE") : "VACANT";
  const ct = bundle.currentLease?.tenant;
  const currentTenant =
    ct && typeof ct === "object"
      ? {
          id: (ct as { id?: string }).id,
          firstName: (ct as { firstName?: string }).firstName,
          lastName: (ct as { lastName?: string }).lastName,
          email: (ct as { email?: string | null }).email ?? null,
          phone: (ct as { phone?: string | null }).phone ?? null
        }
      : null;

  const structureTypeId = structureTypeIdFromProperty(base);
  const totalUnitCount = effectiveActiveUnitCount(structureTypeId, opts?.activeUnitCount);
  const occupancy = derivePropertyOccupancy({
    structureTypeId,
    investmentType: base.investmentType as string | undefined,
    activeLeaseCount: bundle.currentLeases.length,
    totalUnitCount
  });

  return {
    ...base,
    leases: bundle.leases,
    currentLease: bundle.currentLease,
    currentLeases: bundle.currentLeases,
    leaseDisplayStatus,
    combinedMonthlyRentFromLeases: combined,
    occupancyStatus: occupancy.code,
    tenantStatus: occupancyCodeToTenantStatus(occupancy.code),
    activeUnitCount: totalUnitCount,
    leasedUnitCount: occupancy.activeLeaseCount,
    currentTenant,
    aggregateMeta: {
      ...meta,
      historicalLeaseSummaries: bundle.historicalLeaseSummaries,
      counts: {
        ...counts,
        leases: bundle.leases.length,
        currentLeases: bundle.currentLeases.length
      }
    }
  };
}
