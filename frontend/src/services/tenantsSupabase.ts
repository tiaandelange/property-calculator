import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import { snakeRowToCamel } from "../api/propertyRowMapping";
import { dbToTenant, tenantToDb } from "../api/tenantRowMapping";
import { buildTenantDirectory } from "../features/tenants/tenantDirectoryAdapter";
import type { TenantDirectoryMetrics, TenantListItem } from "../features/tenants/tenantDirectoryTypes";

const ACTIVE_LEASE = ["ACTIVE", "MONTH_TO_MONTH"] as const;

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

function isCurrentLeaseStatus(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  return s === "ACTIVE" || s === "MONTH_TO_MONTH";
}

function leaseRowToSummary(row: Record<string, unknown>): Record<string, unknown> {
  const l = snakeRowToCamel(row) as Record<string, unknown>;
  const st = String(l.status ?? "");
  return {
    ...l,
    displayStatus: st
  };
}

const TENANT_SELECT_WITH_PROPERTY = `
  *,
  properties (*)
`;

const LEASE_SELECT_WITH_PROPERTY = `
  *,
  properties ( id, name, address_line1, address_line2, suburb, city )
`;

/**
 * Tenants directory: tenants + leases + open invoices for list UI (RLS-scoped).
 */
export async function listTenantsDirectory(): Promise<{
  items: TenantListItem[];
  metrics: TenantDirectoryMetrics;
}> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: tenantRows, error: tErr } = await sb
    .from("tenants")
    .select(TENANT_SELECT_WITH_PROPERTY)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (tErr) throw toError(tErr);

  const rows = (tenantRows ?? []) as Record<string, unknown>[];
  const tenantIds = rows.map((r) => String((r as { id: string }).id)).filter(Boolean);

  if (!tenantIds.length) {
    return buildTenantDirectory([], [], []);
  }

  const [leasesRes, invoicesRes] = await Promise.all([
    sb
      .from("leases")
      .select(LEASE_SELECT_WITH_PROPERTY)
      .eq("user_id", uid)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false }),
    sb
      .from("invoices")
      .select("id, tenant_id, due_date, status, total, paid_at, property_id")
      .eq("user_id", uid)
      .in("tenant_id", tenantIds)
  ]);

  if (leasesRes.error) throw toError(leasesRes.error);
  if (invoicesRes.error) throw toError(invoicesRes.error);

  return buildTenantDirectory(rows, (leasesRes.data ?? []) as Record<string, unknown>[], (invoicesRes.data ?? []) as Record<string, unknown>[]);
}

/** All tenants for the signed-in user (RLS). */
export async function listTenants(): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tenants")
    .select(TENANT_SELECT_WITH_PROPERTY)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((row) => dbToTenant(row as Record<string, unknown>));
}

/**
 * Tenants for a property: `property_id` match, or active lease on this property.
 * Property ownership is enforced by RLS on `tenants` / `leases` / `properties`.
 */
export async function listTenantsForProperty(propertyId: string | number): Promise<Record<string, unknown>[]> {
  const uid = await requireUserId();
  const pid = String(propertyId);
  const sb = getSupabase();

  const { data: directRows, error: dErr } = await sb
    .from("tenants")
    .select("*")
    .eq("user_id", uid)
    .eq("property_id", pid)
    .order("created_at", { ascending: false });
  if (dErr) throw toError(dErr);

  const { data: leaseRows, error: lErr } = await sb
    .from("leases")
    .select("tenant_id")
    .eq("user_id", uid)
    .eq("property_id", pid)
    .in("status", [...ACTIVE_LEASE]);
  if (lErr) throw toError(lErr);

  const leaseTenantIds = [
    ...new Set((leaseRows ?? []).map((r) => String((r as { tenant_id: string }).tenant_id)))
  ].filter(Boolean);

  let viaLease: Record<string, unknown>[] = [];
  if (leaseTenantIds.length) {
    const { data: ltRows, error: ltErr } = await sb.from("tenants").select("*").eq("user_id", uid).in("id", leaseTenantIds);
    if (ltErr) throw toError(ltErr);
    viaLease = (ltRows ?? []) as Record<string, unknown>[];
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const r of [...(directRows ?? []), ...viaLease]) {
    byId.set(String((r as { id: string }).id), r as Record<string, unknown>);
  }

  const { data: leasesForProp, error: lpErr } = await sb
    .from("leases")
    .select("*")
    .eq("user_id", uid)
    .eq("property_id", pid)
    .order("created_at", { ascending: false });
  if (lpErr) throw toError(lpErr);

  const leasesByTenant = new Map<string, Record<string, unknown>[]>();
  for (const lr of leasesForProp ?? []) {
    const row = lr as Record<string, unknown>;
    const tid = String(row.tenant_id);
    const list = leasesByTenant.get(tid) ?? [];
    list.push(row);
    leasesByTenant.set(tid, list);
  }

  return [...byId.values()].map((row) => {
    const base = dbToTenant(row);
    const leases = leasesByTenant.get(String(base.id)) ?? [];
    const current = leases.find((lr) => isCurrentLeaseStatus((lr as { status: string }).status)) ?? null;
    return {
      ...base,
      currentLease: current ? leaseRowToSummary(current) : null
    };
  });
}

/** `GET /tenants/:id` shape: `{ tenant, currentLease }`. */
export async function getTenant(
  id: string | number
): Promise<{ tenant: Record<string, unknown>; currentLease: Record<string, unknown> | null }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: row, error } = await sb
    .from("tenants")
    .select(TENANT_SELECT_WITH_PROPERTY)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw toError(error);
  if (!row) throw new Error("Tenant not found.");

  const { data: leaseRows, error: lErr } = await sb
    .from("leases")
    .select("*")
    .eq("user_id", uid)
    .eq("tenant_id", String(id))
    .order("created_at", { ascending: false });
  if (lErr) throw toError(lErr);

  const leasesCamel = (leaseRows ?? []).map((lr) => {
    const flat = snakeRowToCamel(lr as Record<string, unknown>) as Record<string, unknown>;
    return { ...flat, displayStatus: String(flat.status ?? "") };
  });

  const current = (leaseRows ?? []).find((lr) => isCurrentLeaseStatus((lr as { status: string }).status)) ?? null;

  const tenant = { ...dbToTenant(row as Record<string, unknown>), leases: leasesCamel };

  return {
    tenant,
    currentLease: current ? leaseRowToSummary(current as Record<string, unknown>) : null
  };
}

/** `POST /tenants` — optional `propertyId`; RLS validates owned property when set. */
export async function createTenant(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const fields = tenantToDb(input);
  const { data, error } = await sb
    .from("tenants")
    .insert({ user_id: uid, ...fields })
    .select(TENANT_SELECT_WITH_PROPERTY)
    .single();
  if (error) throw toError(error);
  return dbToTenant(data as Record<string, unknown>);
}

/** `POST /properties/:propertyId/tenants` */
export async function createTenantForProperty(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const fields = tenantToDb({ ...input, propertyId: String(propertyId) });
  const { data, error } = await sb
    .from("tenants")
    .insert({ user_id: uid, ...fields })
    .select(TENANT_SELECT_WITH_PROPERTY)
    .single();
  if (error) throw toError(error);
  return dbToTenant(data as Record<string, unknown>);
}

export async function updateTenant(id: string | number, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: existing, error: exErr } = await sb
    .from("tenants")
    .select("*")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (exErr) throw toError(exErr);
  if (!existing) throw new Error("Tenant not found.");

  const cur = snakeRowToCamel(existing as Record<string, unknown>) as Record<string, unknown>;
  delete cur.property;
  delete cur.properties;
  const merged = { ...cur, ...input };
  const fields = tenantToDb(merged);

  const { data, error } = await sb
    .from("tenants")
    .update(fields)
    .eq("id", String(id))
    .eq("user_id", uid)
    .select(TENANT_SELECT_WITH_PROPERTY)
    .single();
  if (error) throw toError(error);
  return dbToTenant(data as Record<string, unknown>);
}

/**
 * Soft-delete if any lease exists for tenant; else hard delete (Express parity).
 */
export async function deleteTenant(id: string | number): Promise<{ message: string; tenant?: Record<string, unknown> }> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: leaseCheck, error: lcErr } = await sb.from("leases").select("id").eq("tenant_id", String(id)).eq("user_id", uid).limit(1);
  if (lcErr) throw toError(lcErr);

  if ((leaseCheck ?? []).length > 0) {
    const { data, error } = await sb
      .from("tenants")
      .update({ status: "PAST" })
      .eq("id", String(id))
      .eq("user_id", uid)
      .select(TENANT_SELECT_WITH_PROPERTY)
      .single();
    if (error) throw toError(error);
    return { message: "Tenant marked as past (historical leases retained).", tenant: dbToTenant(data as Record<string, unknown>) };
  }

  const { error } = await sb.from("tenants").delete().eq("id", String(id)).eq("user_id", uid);
  if (error) throw toError(error);
  return { message: "Deleted" };
}

async function assertNoConflictingActiveLeaseElsewhere(
  tenantId: string,
  targetPropertyId: string
): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leases")
    .select("id, property_id")
    .eq("user_id", uid)
    .eq("tenant_id", tenantId)
    .in("status", [...ACTIVE_LEASE]);
  if (error) throw toError(error);
  const bad = (data ?? []).find((r) => String((r as { property_id: string }).property_id) !== targetPropertyId);
  if (bad) {
    throw new Error(
      "Tenant has an active lease. Cancel or terminate the current lease before moving the tenant."
    );
  }
}

/** `PATCH .../link` — RLS rejects linking to another user's property. */
export async function linkTenantToProperty(
  propertyId: string | number,
  tenantId: string | number
): Promise<{ tenant: Record<string, unknown> }> {
  const uid = await requireUserId();
  const pid = String(propertyId);
  const tid = String(tenantId);
  await assertNoConflictingActiveLeaseElsewhere(tid, pid);

  const sb = getSupabase();
  const { data, error } = await sb
    .from("tenants")
    .update({ property_id: pid, status: "ACTIVE" })
    .eq("id", tid)
    .eq("user_id", uid)
    .select(TENANT_SELECT_WITH_PROPERTY)
    .single();
  if (error) throw toError(error);
  return { tenant: dbToTenant(data as Record<string, unknown>) };
}

/** `PATCH .../unlink` */
export async function unlinkTenantFromProperty(
  propertyId: string | number,
  tenantId: string | number
): Promise<{ tenant: Record<string, unknown> }> {
  const uid = await requireUserId();
  const pid = String(propertyId);
  const tid = String(tenantId);
  const sb = getSupabase();

  const { data: activeOnProp, error: aErr } = await sb
    .from("leases")
    .select("id")
    .eq("user_id", uid)
    .eq("tenant_id", tid)
    .eq("property_id", pid)
    .in("status", [...ACTIVE_LEASE])
    .limit(1);
  if (aErr) throw toError(aErr);
  if ((activeOnProp ?? []).length > 0) {
    throw new Error("Cancel the current lease before unlinking this tenant.");
  }

  const { data, error } = await sb
    .from("tenants")
    .update({ property_id: null })
    .eq("id", tid)
    .eq("user_id", uid)
    .eq("property_id", pid)
    .select(TENANT_SELECT_WITH_PROPERTY)
    .single();
  if (error) throw toError(error);
  return { tenant: dbToTenant(data as Record<string, unknown>) };
}
