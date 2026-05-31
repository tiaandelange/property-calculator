import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import {
  buildPropertyInsertRow,
  buildPropertyUpdatePatch,
  enrichPropertyDetail,
  enrichPropertyListItem,
  buildPropertyFieldsFromBody,
  snakeRowToCamel
} from "../api/propertyRowMapping";
import { dbToExpense } from "../api/financialRowMapping";
import { computePropertyMonthlyFinancialSnapshot, normalizePropertyListCardFinancials } from "../features/properties/financials/propertyFinancialsAdapter";
import { mapAdditionalBondPayments } from "../features/properties/financials/propertyBondAdapter";
import * as leasesSupabase from "./leasesSupabase";
import * as invoicesSupabase from "./invoicesSupabase";
import * as propertyUnitsSupabase from "./propertyUnitsSupabase";
import {
  countCurrentLeasesByProperty,
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

function groupRowsByPropertyId(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const pid = String(row.propertyId ?? row.property_id ?? "");
    if (!pid) continue;
    const list = map.get(pid) ?? [];
    list.push(row);
    map.set(pid, list);
  }
  return map;
}

function activeLeasesFromRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((l) => ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? "")));
}

/**
 * Maps a raw `properties` table row (snake_case keys) to the SPA camelCase shape.
 * @param variant `list` — card row + empty aggregates; `detail` — workspace detail + empty relations.
 */
export function dbToProperty(row: Record<string, unknown>, variant: "list" | "detail"): Record<string, unknown> {
  const camel = snakeRowToCamel(row);
  return variant === "detail" ? enrichPropertyDetail(camel) : enrichPropertyListItem(camel);
}

/** Maps a camelCase property payload to DB column names (no `user_id`). */
export function propertyToDb(payload: Record<string, unknown>): Record<string, unknown> {
  return buildPropertyFieldsFromBody(payload);
}

/** Lists properties for the signed-in user (RLS + `user_id` filter). `month` is ignored until dashboard-summary migrates. */
export type PropertyListItem = Record<string, unknown> & { id: string };

export async function enrichPropertyListItems(uid: string, items: PropertyListItem[]): Promise<PropertyListItem[]> {
  if (items.length === 0) return items;
  const sb = getSupabase();
  const ids = items.map((p) => String(p.id));

  const [leaseResult, recurringResult, bondResult, unitResult] = await Promise.all([
    sb
      .from("leases")
      .select("property_id, status, monthly_rent, fixed_term_end_date")
      .eq("user_id", uid)
      .in("property_id", ids),
    sb
      .from("expense_entries")
      .select(
        "id, property_id, category, description, amount, expense_date, is_recurring, status, recurring_schedule_parent_id"
      )
      .eq("user_id", uid)
      .in("property_id", ids)
      .eq("is_recurring", true)
      .is("recurring_schedule_parent_id", null)
      .neq("status", "ARCHIVED"),
    sb
      .from("property_additional_bonds")
      .select(
        "id, property_id, description, outstanding_balance, monthly_payment, annual_interest_rate_percent, bond_term_years, bond_start_date, bond_remaining_term_months"
      )
      .eq("user_id", uid)
      .eq("is_active", true)
      .in("property_id", ids),
    sb
      .from("property_units")
      .select("property_id")
      .eq("user_id", uid)
      .eq("is_active", true)
      .in("property_id", ids)
  ]);

  const { data: leaseRows, error: leaseErr } = leaseResult;
  if (leaseErr) throw toError(leaseErr);
  const leasesByProperty = groupRowsByPropertyId(
    (leaseRows ?? []).map((row) => snakeRowToCamel(row as Record<string, unknown>) as Record<string, unknown>)
  );
  const leaseCounts = countCurrentLeasesByProperty(leaseRows ?? []);

  const { data: recurringRows, error: recurringErr } = recurringResult;
  if (recurringErr) throw toError(recurringErr);
  const recurringByProperty = groupRowsByPropertyId((recurringRows ?? []).map((row) => dbToExpense(row as Record<string, unknown>)));

  const additionalBondByProperty = new Map<string, number>();
  type AdditionalBondRow = Parameters<typeof mapAdditionalBondPayments>[0][number];
  const { data: additionalBondRows, error: bondErr } = bondResult;
  if (!bondErr && additionalBondRows) {
    const bondsGrouped = new Map<string, AdditionalBondRow[]>();
    for (const row of additionalBondRows as Record<string, unknown>[]) {
      const c = snakeRowToCamel(row) as Record<string, unknown>;
      const pid = String(c.propertyId ?? "");
      if (!pid) continue;
      const bond: AdditionalBondRow = {
        id: String(c.id),
        description: String(c.description ?? ""),
        outstandingBalance: c.outstandingBalance != null ? Number(c.outstandingBalance) : null,
        monthlyPayment: c.monthlyPayment != null ? Number(c.monthlyPayment) : null,
        bondAnnualInterestRatePercent:
          c.annualInterestRatePercent != null ? Number(c.annualInterestRatePercent) : null,
        bondTermYears: c.bondTermYears != null ? Number(c.bondTermYears) : null,
        bondStartDate: c.bondStartDate != null ? String(c.bondStartDate).slice(0, 10) : null,
        bondRemainingTermMonths: c.bondRemainingTermMonths != null ? Number(c.bondRemainingTermMonths) : null
      };
      const list = bondsGrouped.get(pid) ?? [];
      list.push(bond);
      bondsGrouped.set(pid, list);
    }
    for (const [pid, bonds] of bondsGrouped) {
      const total = mapAdditionalBondPayments(bonds).reduce((a, b) => a + b.monthlyPayment, 0);
      additionalBondByProperty.set(pid, total);
    }
  }

  const unitCounts = new Map<string, number>();
  const { data: unitRows, error: unitErr } = unitResult;
  if (!unitErr && unitRows) {
    for (const row of unitRows) {
      const pid = String((row as { property_id: string }).property_id);
      unitCounts.set(pid, (unitCounts.get(pid) ?? 0) + 1);
    }
  }

  return items.map((p) => {
    const pid = String(p.id);
    const structureTypeId = structureTypeIdFromProperty(p);
    const totalUnitCount = effectiveActiveUnitCount(structureTypeId, unitCounts.get(pid));
    const propertyLeases = leasesByProperty.get(pid) ?? [];
    const currentLeases = activeLeasesFromRows(propertyLeases);
    const occupancy = derivePropertyOccupancy({
      structureTypeId,
      investmentType: p.investmentType as string | undefined,
      activeLeaseCount: leaseCounts.get(pid) ?? 0,
      totalUnitCount
    });

    const financials = computePropertyMonthlyFinancialSnapshot({
      property: p,
      currentLeases,
      recurringCharges: recurringByProperty.get(pid) ?? [],
      additionalBondMonthlyTotal: additionalBondByProperty.get(pid) ?? 0
    });

    return normalizePropertyListCardFinancials({
      ...p,
      occupancyStatus: occupancy.code,
      tenantStatus: occupancyCodeToTenantStatus(occupancy.code),
      leasedUnitCount: occupancy.activeLeaseCount,
      activeUnitCount: totalUnitCount,
      currentLeases,
      combinedMonthlyLeaseRent: financials.combinedMonthlyLeaseRent,
      monthlyRent: financials.monthlyRent,
      monthlyIncome: financials.monthlyIncome,
      monthlyOperatingExpenses: financials.monthlyOperatingExpenses,
      monthlyDebtService: financials.monthlyDebtService,
      monthlyExpenses: financials.monthlyExpenses,
      monthlyNOI: financials.monthlyNOI,
      monthlyCashFlowAfterDebtService: financials.monthlyCashFlowAfterDebtService,
      netCashFlow: financials.netCashFlow
    }) as PropertyListItem;
  });
}

export type PropertyOption = { id: string; name: string };

/** Lightweight id/name list for filter dropdowns and shell switchers (no enrichment queries). */
export async function listPropertyOptions(): Promise<PropertyOption[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("properties")
    .select("id, name")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    name: String((row as { name?: string }).name ?? "Property")
  }));
}

export async function listProperties(_params?: { month?: string }): Promise<PropertyListItem[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  const list = (data ?? []).map((row) => dbToProperty(row as Record<string, unknown>, "list") as PropertyListItem);
  return enrichPropertyListItems(uid, list);
}

/** Fetches one property by id for the signed-in user. */
export async function getProperty(
  id: string | number,
  opts?: { bustCache?: boolean; month?: string; includeInvoices?: boolean }
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) {
    throw new Error("Property not found");
  }
  const base = dbToProperty(data as Record<string, unknown>, "detail");
  const includeInvoices = opts?.includeInvoices !== false;

  const unitsPromise = propertyUnitsSupabase.listPropertyUnits(String(id)).catch(() => [] as Awaited<
    ReturnType<typeof propertyUnitsSupabase.listPropertyUnits>
  >);
  const leaseBundlePromise = leasesSupabase.listLeasesForProperty(String(id));
  const invoicesPromise = includeInvoices
    ? invoicesSupabase.listInvoices(String(id), { attachDownloadUrls: false })
    : Promise.resolve([] as Record<string, unknown>[]);

  const [units, leaseBundle, invoices] = await Promise.all([unitsPromise, leaseBundlePromise, invoicesPromise]);

  let activeUnitCount: number | undefined;
  const n = units.filter((u) => u.isActive !== false).length;
  if (n > 0) activeUnitCount = n;

  const merged = leasesSupabase.mergeLeaseBundleIntoPropertyDetail(base, leaseBundle, { activeUnitCount });
  return includeInvoices ? { ...merged, invoices } : merged;
}

/** Inserts a property with `user_id = auth.uid()`. */
export async function createProperty(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const row = buildPropertyInsertRow(uid, payload);
  const { data, error } = await sb.from("properties").insert(row).select("*").single();
  if (error) throw toError(error);
  return dbToProperty(data as Record<string, unknown>, "detail");
}

/** Updates a property owned by the signed-in user. */
export async function updateProperty(id: string | number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const patch = buildPropertyUpdatePatch(payload);
  const { data, error } = await sb
    .from("properties")
    .update(patch)
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbToProperty(data as Record<string, unknown>, "detail");
}

/**
 * Hard-deletes a property (matches current UX copy: permanent delete).
 * RLS restricts to the owner row.
 */
export async function deleteProperty(id: string | number): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { error } = await sb.from("properties").delete().eq("id", String(id)).eq("user_id", uid);
  if (error) throw toError(error);
}

/** Property workspace “Reports” tab — stored PDFs linked to this property. */
export async function listPropertyWorkspaceReports(propertyId: string | number): Promise<{
  reports: Array<{
    id: string;
    title: string;
    description: string;
    tab: string;
    href: string | null;
  }>;
}> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const pid = String(propertyId);
  const { data, error } = await sb
    .from("stored_reports")
    .select("id, file_name, created_at, metadata")
    .eq("property_id", pid)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  const reports = (data ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const title = String(meta.title ?? row.file_name ?? "Report");
    const description = String(meta.description ?? `Generated ${row.created_at ?? ""}`);
    return {
      id: String(row.id),
      title,
      description,
      tab: String(meta.tab ?? "financials"),
      href: null as string | null
    };
  });
  return { reports };
}
