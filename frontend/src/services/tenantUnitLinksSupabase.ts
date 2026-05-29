import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import { dbToTenant } from "../api/tenantRowMapping";
import { dbToLease } from "../api/leaseRowMapping";
import { leaseDisplayStatus } from "../utils/leaseDisplay";
import type { TenantLinkRole, TenantLinkStatus, TenantUnitLinkRecord } from "../features/properties/link-tenants/tenantUnitLinkTypes";

const ACTIVE_LEASE = ["ACTIVE", "MONTH_TO_MONTH"] as const;

const LINK_SELECT = `
  *,
  tenants ( id, first_name, last_name, email, phone, status ),
  leases ( id, status, fixed_term_end_date, monthly_rent )
`;

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    return new Error([pe.message, pe.hint, pe.details].filter(Boolean).join(" — ") || "Database request failed.");
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

function rowToLink(row: Record<string, unknown>): TenantUnitLinkRecord {
  const tenantRaw = row.tenants ?? row.tenant;
  const leaseRaw = row.leases ?? row.lease;
  let tenant: TenantUnitLinkRecord["tenant"];
  if (tenantRaw && typeof tenantRaw === "object" && !Array.isArray(tenantRaw)) {
    const t = dbToTenant(tenantRaw as Record<string, unknown>);
    tenant = {
      id: String(t.id),
      firstName: String(t.firstName ?? ""),
      lastName: String(t.lastName ?? ""),
      email: t.email != null ? String(t.email) : null,
      phone: t.phone != null ? String(t.phone) : null,
      status: String(t.status ?? "")
    };
  }
  let lease: TenantUnitLinkRecord["lease"] = null;
  if (leaseRaw && typeof leaseRaw === "object" && !Array.isArray(leaseRaw)) {
    const l = dbToLease(leaseRaw as Record<string, unknown>);
    lease = {
      id: String(l.id),
      status: String(l.status ?? ""),
      displayStatus: leaseDisplayStatus({
        status: String(l.status ?? ""),
        fixedTermEndDate: l.fixedTermEndDate as string | null | undefined
      }),
      monthlyRent: l.monthlyRent != null ? Number(l.monthlyRent) : undefined
    };
  }
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    unitId: row.unit_id != null ? String(row.unit_id) : null,
    tenantId: String(row.tenant_id),
    leaseId: row.lease_id != null ? String(row.lease_id) : null,
    role: String(row.role ?? "occupant") as TenantLinkRole,
    status: String(row.status ?? "active") as TenantLinkStatus,
    isPrimary: row.is_primary === true,
    startDate: row.start_date != null ? String(row.start_date).slice(0, 10) : null,
    endDate: row.end_date != null ? String(row.end_date).slice(0, 10) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
    tenant,
    lease
  };
}

async function assertNoDuplicateActiveLink(
  tenantId: string,
  unitId: string | null,
  excludeId?: string
): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  let q = sb
    .from("tenant_unit_links")
    .select("id, unit_id, property_id")
    .eq("user_id", uid)
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (unitId) q = q.eq("unit_id", unitId);
  else q = q.is("unit_id", null);
  const { data, error } = await q;
  if (error) throw toError(error);
  const dup = (data ?? []).find((r) => String((r as { id: string }).id) !== String(excludeId ?? ""));
  if (dup) {
    throw new Error("This tenant is already actively linked to this unit.");
  }
}

async function clearPrimaryForUnit(unitId: string | null, propertyId: string, excludeId?: string): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  let q = sb
    .from("tenant_unit_links")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("property_id", propertyId)
    .eq("is_primary", true)
    .eq("status", "active");
  if (unitId) q = q.eq("unit_id", unitId);
  else q = q.is("unit_id", null);
  if (excludeId) q = q.neq("id", excludeId);
  const { error } = await q;
  if (error) throw toError(error);
}

async function ensureTenantPropertyAssociation(_tenantId: string, _propertyId: string): Promise<void> {
  // Occupancy is lease-driven; do not write tenants.property_id.
}

export async function listTenantUnitLinksForProperty(propertyId: string): Promise<TenantUnitLinkRecord[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tenant_unit_links")
    .select(LINK_SELECT)
    .eq("property_id", String(propertyId))
    .eq("user_id", uid)
    .neq("status", "removed")
    .order("created_at", { ascending: true });
  if (error) throw toError(error);
  return (data ?? []).map((r) => rowToLink(r as Record<string, unknown>));
}

export type CreateTenantUnitLinkInput = {
  propertyId: string;
  unitId?: string | null;
  tenantId: string;
  role?: TenantLinkRole;
  status?: TenantLinkStatus;
  isPrimary?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  leaseId?: string | null;
};

export async function createTenantUnitLink(input: CreateTenantUnitLinkInput): Promise<TenantUnitLinkRecord> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const propertyId = String(input.propertyId);
  const tenantId = String(input.tenantId);
  const unitId = input.unitId != null && String(input.unitId).trim() ? String(input.unitId) : null;
  const status = (input.status ?? "active") as TenantLinkStatus;

  if (status === "active") {
    await assertNoDuplicateActiveLink(tenantId, unitId);
  }

  if (input.isPrimary) {
    await clearPrimaryForUnit(unitId, propertyId);
  }

  await ensureTenantPropertyAssociation(tenantId, propertyId);

  const row = {
    property_id: propertyId,
    unit_id: unitId,
    tenant_id: tenantId,
    user_id: uid,
    lease_id: input.leaseId ?? null,
    role: input.role ?? (input.isPrimary ? "primary_tenant" : "occupant"),
    status,
    is_primary: Boolean(input.isPrimary),
    start_date: input.startDate?.trim() ? input.startDate.trim().slice(0, 10) : null,
    end_date: input.endDate?.trim() ? input.endDate.trim().slice(0, 10) : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await sb.from("tenant_unit_links").insert(row).select(LINK_SELECT).single();
  if (error) throw toError(error);
  return rowToLink(data as Record<string, unknown>);
}

export type UpdateTenantUnitLinkInput = {
  role?: TenantLinkRole;
  status?: TenantLinkStatus;
  isPrimary?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  leaseId?: string | null;
};

export async function updateTenantUnitLink(linkId: string, input: UpdateTenantUnitLinkInput): Promise<TenantUnitLinkRecord> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: existing, error: exErr } = await sb
    .from("tenant_unit_links")
    .select("*")
    .eq("id", linkId)
    .eq("user_id", uid)
    .maybeSingle();
  if (exErr) throw toError(exErr);
  if (!existing) throw new Error("Tenant link not found.");

  const ex = existing as Record<string, unknown>;
  const unitId = ex.unit_id != null ? String(ex.unit_id) : null;
  const propertyId = String(ex.property_id);
  const tenantId = String(ex.tenant_id);
  const nextStatus = (input.status ?? String(ex.status)) as TenantLinkStatus;

  if (nextStatus === "active" && String(ex.status) !== "active") {
    await assertNoDuplicateActiveLink(tenantId, unitId, linkId);
  }

  if (input.isPrimary) {
    await clearPrimaryForUnit(unitId, propertyId, linkId);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.role != null) patch.role = input.role;
  if (input.status != null) patch.status = input.status;
  if (input.isPrimary != null) patch.is_primary = input.isPrimary;
  if (input.startDate !== undefined) patch.start_date = input.startDate?.trim() ? input.startDate.trim().slice(0, 10) : null;
  if (input.endDate !== undefined) patch.end_date = input.endDate?.trim() ? input.endDate.trim().slice(0, 10) : null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() ? input.notes.trim() : null;
  if (input.leaseId !== undefined) patch.lease_id = input.leaseId;

  const { data, error } = await sb
    .from("tenant_unit_links")
    .update(patch)
    .eq("id", linkId)
    .eq("user_id", uid)
    .select(LINK_SELECT)
    .single();
  if (error) throw toError(error);
  return rowToLink(data as Record<string, unknown>);
}

export async function removeTenantUnitLink(linkId: string): Promise<TenantUnitLinkRecord> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: existing, error: exErr } = await sb
    .from("tenant_unit_links")
    .select("*, leases(id, status)")
    .eq("id", linkId)
    .eq("user_id", uid)
    .maybeSingle();
  if (exErr) throw toError(exErr);
  if (!existing) throw new Error("Tenant link not found.");

  const ex = existing as Record<string, unknown>;
  const leaseRaw = ex.leases ?? ex.lease;
  if (leaseRaw && typeof leaseRaw === "object") {
    const st = String((leaseRaw as { status?: string }).status ?? "").toUpperCase();
    if (ACTIVE_LEASE.includes(st as (typeof ACTIVE_LEASE)[number])) {
      throw new Error("This tenant is linked to an active lease. End or update the lease before removing the tenant link.");
    }
  }

  if (ex.lease_id) {
    const { data: leaseRow, error: lErr } = await sb
      .from("leases")
      .select("status")
      .eq("id", String(ex.lease_id))
      .eq("user_id", uid)
      .maybeSingle();
    if (lErr) throw toError(lErr);
    const st = String(leaseRow?.status ?? "").toUpperCase();
    if (ACTIVE_LEASE.includes(st as (typeof ACTIVE_LEASE)[number])) {
      throw new Error("This tenant is linked to an active lease. End or update the lease before removing the tenant link.");
    }
  }

  const { data, error } = await sb
    .from("tenant_unit_links")
    .update({ status: "removed", is_primary: false, updated_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("user_id", uid)
    .select(LINK_SELECT)
    .single();
  if (error) throw toError(error);
  return rowToLink(data as Record<string, unknown>);
}

export async function findActiveLinksForTenant(tenantId: string): Promise<TenantUnitLinkRecord[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tenant_unit_links")
    .select(LINK_SELECT)
    .eq("tenant_id", tenantId)
    .eq("user_id", uid)
    .eq("status", "active");
  if (error) throw toError(error);
  return (data ?? []).map((r) => rowToLink(r as Record<string, unknown>));
}
