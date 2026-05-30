import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import { snakeRowToCamel } from "../api/propertyRowMapping";
import { dbToTenant, tenantToDb } from "../api/tenantRowMapping";
import { buildTenantDirectory, computeApplicantDirectoryMetrics } from "../features/tenants/tenantDirectoryAdapter";
import type { TenantDirectoryMetrics, TenantListItem } from "../features/tenants/tenantDirectoryTypes";
import { matchesTenantDirectoryFilters, PAGE_SIZE, paginate } from "../features/tenants/tenantDirectoryUtils";
import type { TenantsDirectoryParams } from "../lib/queryKeys";
import { leaseDisplayStatus } from "../utils/leaseDisplay";

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
  properties!tenants_property_id_fkey (*),
  applied_property:properties!tenants_applied_property_id_fkey ( id, name, address_line1, address_line2, suburb, city )
`;

const TENANT_LEASE_SELECT = `
  id,
  user_id,
  tenant_id,
  property_id,
  unit_id,
  status,
  start_date,
  fixed_term_end_date,
  monthly_rent,
  rent_due_day,
  lease_type,
  lease_reference,
  created_at
`;

const LEASE_SELECT_WITH_PROPERTY = `
  *,
  properties ( id, name, address_line1, address_line2, suburb, city )
`;

/**
 * Tenants directory: tenants + leases + open invoices for list UI (RLS-scoped).
 * Returns one page of items when pagination params are supplied.
 */
export async function listTenantsDirectory(opts?: TenantsDirectoryParams): Promise<{
  items: TenantListItem[];
  metrics: TenantDirectoryMetrics;
  applicantMetrics: ReturnType<typeof computeApplicantDirectoryMetrics>;
  totalCount: number;
}> {
  const uid = await requireUserId();
  const sb = getSupabase();

  let tenantQuery = sb
    .from("tenants")
    .select(TENANT_SELECT_WITH_PROPERTY)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (opts?.propertyId && opts.propertyId !== "ALL") {
    tenantQuery = tenantQuery.eq("property_id", String(opts.propertyId));
  }

  const { data: tenantRows, error: tErr } = await tenantQuery;
  if (tErr) throw toError(tErr);

  const rows = (tenantRows ?? []) as Record<string, unknown>[];
  const tenantIds = rows.map((r) => String((r as { id: string }).id)).filter(Boolean);

  if (!tenantIds.length) {
    const empty = buildTenantDirectory([], [], []);
    return { ...empty, applicantMetrics: computeApplicantDirectoryMetrics([]), totalCount: 0 };
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

  const directory = buildTenantDirectory(
    rows,
    (leasesRes.data ?? []) as Record<string, unknown>[],
    (invoicesRes.data ?? []) as Record<string, unknown>[]
  );

  const applicantIds = directory.items
    .filter((item) => String(item.tenantStatus ?? "").toUpperCase() === "APPLICANT")
    .map((item) => item.id);

  let items = directory.items;
  if (applicantIds.length) {
    const { data: appRows, error: appErr } = await sb
      .from("applicant_application_details")
      .select("tenant_id, monthly_income, fit_score, target_rent, submitted_at")
      .eq("user_id", uid)
      .in("tenant_id", applicantIds);

    if (appErr) throw toError(appErr);

    const appByTenant = new Map(
      (appRows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return [
          String(r.tenant_id ?? ""),
          {
            monthlyIncome: Number(r.monthly_income ?? 0),
            fitScore: Number(r.fit_score ?? 0),
            targetRent: Number(r.target_rent ?? 0),
            submittedAt: r.submitted_at != null ? String(r.submitted_at) : null
          }
        ] as const;
      })
    );

    items = directory.items.map((item) => {
      const app = appByTenant.get(item.id);
      if (!app) return item;
      return {
        ...item,
        monthlyIncome: app.monthlyIncome,
        fitScore: app.fitScore,
        targetRent: app.targetRent,
        applicationSubmittedAt: app.submittedAt
      };
    });
  }

  const filtered = items.filter((item) => matchesTenantDirectoryFilters(item, opts ?? {}));
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? PAGE_SIZE);
  const { slice, totalCount } = paginate(filtered, page, pageSize);

  return {
    items: slice,
    metrics: directory.metrics,
    applicantMetrics: computeApplicantDirectoryMetrics(items),
    totalCount
  };
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
 * Tenants for a property: derived from leases and lease_tenants only.
 */
export async function listTenantsForProperty(propertyId: string | number): Promise<Record<string, unknown>[]> {
  const uid = await requireUserId();
  const pid = String(propertyId);
  const sb = getSupabase();

  const { data: leaseRows, error: lErr } = await sb
    .from("leases")
    .select(
      `
      *,
      lease_tenants (
        tenant_id,
        role,
        is_primary,
        tenants ( id, first_name, last_name, email, phone, status )
      )
    `
    )
    .eq("user_id", uid)
    .eq("property_id", pid)
    .order("created_at", { ascending: false });
  if (lErr) throw toError(lErr);

  const byId = new Map<string, Record<string, unknown>>();
  const leasesByTenant = new Map<string, Record<string, unknown>[]>();

  for (const lr of leaseRows ?? []) {
    const lease = lr as Record<string, unknown>;
    const leaseCamel = snakeRowToCamel(lease) as Record<string, unknown>;
    const disp = leaseDisplayStatus({
      status: String(leaseCamel.status ?? ""),
      fixedTermEndDate: (leaseCamel.fixedTermEndDate as string | null | undefined) ?? null
    });
    const leaseSummary = { ...leaseCamel, displayStatus: disp };

    const ltRows = (lease.lease_tenants ?? []) as Record<string, unknown>[];
    const tenantRows =
      ltRows.length > 0
        ? ltRows
        : leaseCamel.tenant_id
          ? [{ tenant_id: leaseCamel.tenant_id, tenants: lease.tenants }]
          : [];

    for (const lt of tenantRows) {
      const tenantRaw = lt.tenants ?? lt.tenant;
      if (!tenantRaw || typeof tenantRaw !== "object" || Array.isArray(tenantRaw)) continue;
      const base = dbToTenant(tenantRaw as Record<string, unknown>);
      const tid = String(base.id);
      byId.set(tid, base);
      const list = leasesByTenant.get(tid) ?? [];
      list.push(leaseSummary);
      leasesByTenant.set(tid, list);
    }
  }

  return [...byId.values()].map((row) => {
    const leases = leasesByTenant.get(String(row.id)) ?? [];
    const current = leases.find((lr) => isCurrentLeaseStatus(String((lr as { status: string }).status))) ?? null;
    return {
      ...row,
      currentLease: current ? leaseRowToSummary(current) : null
    };
  });
}

/**
 * Global tenants eligible for a new lease on this property.
 * Uses the single tenants directory — excludes past tenants and anyone with an active lease.
 */
export async function listTenantsEligibleForProperty(
  propertyId: string | number
): Promise<Record<string, unknown>[]> {
  const uid = await requireUserId();
  void propertyId;
  const sb = getSupabase();

  const { data: allRows, error } = await sb
    .from("tenants")
    .select(TENANT_SELECT_WITH_PROPERTY)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);

  const { data: activeLeaseTenants, error: ltErr } = await sb
    .from("lease_tenants")
    .select("tenant_id, leases!inner ( property_id, status, cancellation_date )")
    .eq("user_id", uid);
  if (ltErr) throw toError(ltErr);

  const tenantsWithActiveLease = new Set<string>();
  for (const row of activeLeaseTenants ?? []) {
    const r = row as { tenant_id: string; leases?: { property_id?: string; status?: string; cancellation_date?: string | null } | { property_id?: string; status?: string; cancellation_date?: string | null }[] };
    const leaseRaw = r.leases;
    const lease = Array.isArray(leaseRaw) ? leaseRaw[0] : leaseRaw;
    if (!lease) continue;
    const st = String(lease.status ?? "").toUpperCase();
    if (st !== "ACTIVE" && st !== "MONTH_TO_MONTH") continue;
    if (lease.cancellation_date != null) continue;
    tenantsWithActiveLease.add(String(r.tenant_id));
  }

  return (allRows ?? [])
    .filter((row) => {
      const r = row as { id: string; status?: string };
      const status = String(r.status ?? "ACTIVE").toUpperCase();
      if (status === "PAST") return false;
      return !tenantsWithActiveLease.has(String(r.id));
    })
    .map((row) => dbToTenant(row as Record<string, unknown>));
}

/** `GET /tenants/:id` shape: `{ tenant, currentLease }`. */
export async function getTenant(
  id: string | number
): Promise<{ tenant: Record<string, unknown>; currentLease: Record<string, unknown> | null }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const tenantId = String(id);

  const [tenantRes, leaseRes] = await Promise.all([
    sb.from("tenants").select(TENANT_SELECT_WITH_PROPERTY).eq("id", tenantId).maybeSingle(),
    sb
      .from("leases")
      .select(TENANT_LEASE_SELECT)
      .eq("user_id", uid)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
  ]);

  const { data: row, error } = tenantRes;
  if (error) throw toError(error);
  if (!row) throw new Error("Tenant not found.");

  if (leaseRes.error) throw toError(leaseRes.error);
  const leaseRows = leaseRes.data ?? [];

  const leasesCamel = leaseRows.map((lr) => {
    const flat = snakeRowToCamel(lr as Record<string, unknown>) as Record<string, unknown>;
    return { ...flat, displayStatus: String(flat.status ?? "") };
  });

  const current = leaseRows.find((lr) => isCurrentLeaseStatus((lr as { status: string }).status)) ?? null;

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
  const rawStatus = String(input.status ?? "ACTIVE").toUpperCase();
  const status = rawStatus === "APPLICANT" ? "APPLICANT" : "ACTIVE";
  const { data, error } = await sb
    .from("tenants")
    .insert({ user_id: uid, status, ...fields })
    .select(TENANT_SELECT_WITH_PROPERTY)
    .single();
  if (error) throw toError(error);
  return dbToTenant(data as Record<string, unknown>);
}

/** @deprecated Create a global tenant; link via Create Lease instead. */
export async function createTenantForProperty(
  _propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return createTenant(input);
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
  delete cur.appliedProperty;
  delete cur.applied_property;
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

/** @deprecated Link tenants by creating a lease. */
export async function linkTenantToProperty(
  propertyId: string | number,
  tenantId: string | number
): Promise<{ tenant: Record<string, unknown> }> {
  await requireUserId();
  void propertyId;
  void tenantId;
  throw new Error("Link tenants by creating a lease. Direct property links are no longer supported.");
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
