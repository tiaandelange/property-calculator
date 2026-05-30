import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import { snakeRowToCamel } from "../api/propertyRowMapping";
import { dbToTenant, tenantToDb } from "../api/tenantRowMapping";
import type {
  ApplicantDirectoryMetrics,
  TenantDirectoryMetrics,
  TenantListItem
} from "../features/tenants/tenantDirectoryTypes";
import { PAGE_SIZE } from "../features/tenants/tenantDirectoryUtils";
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

function mapTenantDirectoryItem(raw: Record<string, unknown>): TenantListItem {
  return {
    id: String(raw.id ?? ""),
    firstName: String(raw.firstName ?? ""),
    lastName: String(raw.lastName ?? ""),
    fullName: String(raw.fullName ?? ""),
    email: raw.email != null ? String(raw.email) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    avatarUrl: null,
    tenantStatus: raw.tenantStatus != null ? String(raw.tenantStatus) : null,
    propertyId: raw.propertyId != null ? String(raw.propertyId) : null,
    propertyName: raw.propertyName != null ? String(raw.propertyName) : null,
    propertyAddress: raw.propertyAddress != null ? String(raw.propertyAddress) : null,
    unitNumber: raw.unitNumber != null ? String(raw.unitNumber) : null,
    leaseId: raw.leaseId != null ? String(raw.leaseId) : null,
    monthlyRent: raw.monthlyRent != null ? Number(raw.monthlyRent) : null,
    leaseStartDate: raw.leaseStartDate != null ? String(raw.leaseStartDate) : null,
    leaseEndDate: raw.leaseEndDate != null ? String(raw.leaseEndDate) : null,
    leaseStatus: raw.leaseStatus != null ? String(raw.leaseStatus) : null,
    leaseDisplayStatus: raw.leaseDisplayStatus != null ? String(raw.leaseDisplayStatus) : null,
    paymentStatus: raw.paymentStatus != null ? (String(raw.paymentStatus) as TenantListItem["paymentStatus"]) : null,
    outstandingAmount: raw.outstandingAmount != null ? Number(raw.outstandingAmount) : null,
    lastPaymentDate: raw.lastPaymentDate != null ? String(raw.lastPaymentDate) : null,
    nextPaymentDueDate: raw.nextPaymentDueDate != null ? String(raw.nextPaymentDueDate) : null,
    monthlyIncome: raw.monthlyIncome != null ? Number(raw.monthlyIncome) : null,
    fitScore: raw.fitScore != null ? Number(raw.fitScore) : null,
    targetRent: raw.targetRent != null ? Number(raw.targetRent) : null,
    applicationSubmittedAt: raw.applicationSubmittedAt != null ? String(raw.applicationSubmittedAt) : null
  };
}

/**
 * Tenants directory via single RPC (server-side filter/sort/pagination).
 */
export async function listTenantsDirectory(opts?: TenantsDirectoryParams): Promise<{
  items: TenantListItem[];
  metrics: TenantDirectoryMetrics;
  applicantMetrics: ApplicantDirectoryMetrics;
  totalCount: number;
}> {
  await requireUserId();
  const sb = getSupabase();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  const propertyId = opts?.propertyId && opts.propertyId !== "ALL" ? String(opts.propertyId) : null;

  const { data, error } = await sb.rpc("get_tenants_directory", {
    p_limit: pageSize,
    p_offset: offset,
    p_search: opts?.q?.trim() || null,
    p_property_id: propertyId,
    p_lease_status: opts?.leaseStatus && opts.leaseStatus !== "ALL" ? opts.leaseStatus : null,
    p_payment_status: opts?.paymentStatus && opts.paymentStatus !== "ALL" ? opts.paymentStatus : null,
    p_tab: opts?.tab ?? "tenants"
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Empty tenants directory response.");
  }

  const payload = data as Record<string, unknown>;
  const rawItems = (payload.items ?? []) as Record<string, unknown>[];
  const rawMetrics = (payload.metrics ?? {}) as Record<string, unknown>;
  const rawApplicantMetrics = (payload.applicantMetrics ?? {}) as Record<string, unknown>;

  return {
    items: rawItems.map(mapTenantDirectoryItem),
    metrics: {
      totalTenants: Number(rawMetrics.totalTenants ?? 0),
      activeLeases: Number(rawMetrics.activeLeases ?? 0),
      pendingPaymentsTotal: Number(rawMetrics.pendingPaymentsTotal ?? 0),
      pendingPaymentsCount: Number(rawMetrics.pendingPaymentsCount ?? 0),
      renewalsDue: Number(rawMetrics.renewalsDue ?? 0)
    },
    applicantMetrics: {
      totalApplicants: Number(rawApplicantMetrics.totalApplicants ?? 0),
      awaitingProperty: Number(rawApplicantMetrics.awaitingProperty ?? 0),
      linkedToProperty: Number(rawApplicantMetrics.linkedToProperty ?? 0),
      readyForLease: Number(rawApplicantMetrics.readyForLease ?? 0)
    },
    totalCount: Number(payload.totalCount ?? 0)
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
