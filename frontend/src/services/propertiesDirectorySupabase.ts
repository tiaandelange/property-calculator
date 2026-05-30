import { getSupabase } from "../lib/supabaseClient";
import type { PropertiesDirectoryParams } from "../lib/queryKeys";
import {
  investmentTypeSqlFilter,
  matchesPropertyOccupancyFilter,
  needsFinancialSort,
  needsOccupancyAggregateFilter,
  occupancyFromAggregates,
  PROPERTIES_DIRECTORY_PAGE_SIZE,
  sortPropertyDirectoryItems
} from "../features/properties/propertiesDirectoryUtils";
import { countCurrentLeasesByProperty } from "../utils/propertyOccupancy";
import { dbToProperty, enrichPropertyListItems, type PropertyListItem } from "./propertiesSupabase";

function toError(e: { message?: string; hint?: string; details?: string }): Error {
  const parts = [e.message, e.hint, e.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Database request failed.");
}

async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPropertySearchFilter(query: any, q: string | undefined) {
  const needle = q?.trim();
  if (!needle) return query;
  const pattern = `%${needle.replace(/%/g, "\\%")}%`;
  return query.or(`name.ilike.${pattern},address_line1.ilike.${pattern},city.ilike.${pattern}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyInvestmentTypeFilter(query: any, type: string | undefined, status: string | undefined) {
  const statusTypes = investmentTypeSqlFilter(status);
  if (statusTypes?.length) {
    return query.in("investment_type", statusTypes);
  }
  const t = String(type ?? "ALL");
  if (t !== "ALL") {
    return query.eq("investment_type", t);
  }
  return query;
}

async function fetchOccupancyAggregates(uid: string, propertyIds: string[]) {
  if (!propertyIds.length) {
    return { leaseCounts: new Map<string, number>(), unitCounts: new Map<string, number>() };
  }
  const sb = getSupabase();
  const [leaseRes, unitRes] = await Promise.all([
    sb
      .from("leases")
      .select("property_id, status, fixed_term_end_date")
      .eq("user_id", uid)
      .in("property_id", propertyIds),
    sb
      .from("property_units")
      .select("property_id")
      .eq("user_id", uid)
      .eq("is_active", true)
      .in("property_id", propertyIds)
  ]);
  if (leaseRes.error) throw toError(leaseRes.error);
  if (unitRes.error) throw toError(unitRes.error);

  const unitCounts = new Map<string, number>();
  for (const row of unitRes.data ?? []) {
    const pid = String((row as { property_id: string }).property_id);
    unitCounts.set(pid, (unitCounts.get(pid) ?? 0) + 1);
  }
  return {
    leaseCounts: countCurrentLeasesByProperty((leaseRes.data ?? []) as { property_id?: unknown; status?: unknown; fixed_term_end_date?: unknown }[]),
    unitCounts
  };
}

function attachOccupancyStatus(
  items: PropertyListItem[],
  leaseCounts: Map<string, number>,
  unitCounts: Map<string, number>
): PropertyListItem[] {
  return items.map((p) => ({
    ...p,
    occupancyStatus: occupancyFromAggregates(p, leaseCounts, unitCounts)
  }));
}

/** Portfolio property directory with server-side pagination where possible. */
export async function getPropertiesDirectory(opts?: PropertiesDirectoryParams): Promise<{
  items: PropertyListItem[];
  totalCount: number;
}> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? PROPERTIES_DIRECTORY_PAGE_SIZE);
  const sort = String(opts?.sort ?? "RECENT");
  const status = String(opts?.status ?? "ALL");
  const useSqlPagination =
    !needsFinancialSort(sort) &&
    !needsOccupancyAggregateFilter(status) &&
    !investmentTypeSqlFilter(status);

  let query = sb.from("properties").select("*", { count: "exact" }).eq("user_id", uid);
  query = applyPropertySearchFilter(query, opts?.q);
  query = applyInvestmentTypeFilter(query, opts?.type, status);
  query = query.order("created_at", { ascending: false });

  if (useSqlPagination) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw toError(error);
    const list = (data ?? []).map((row) => dbToProperty(row as Record<string, unknown>, "list") as PropertyListItem);
    const enriched = await enrichPropertyListItems(uid, list);
    return { items: enriched, totalCount: count ?? enriched.length };
  }

  const { data, error } = await query;
  if (error) throw toError(error);
  let list = (data ?? []).map((row) => dbToProperty(row as Record<string, unknown>, "list") as PropertyListItem);

  if (needsOccupancyAggregateFilter(status) || needsFinancialSort(sort)) {
    const ids = list.map((p) => String(p.id));
    const { leaseCounts, unitCounts } = await fetchOccupancyAggregates(uid, ids);
    list = attachOccupancyStatus(list, leaseCounts, unitCounts);
    list = list.filter((p) => matchesPropertyOccupancyFilter(p, status));
  }

  if (needsFinancialSort(sort)) {
    list = await enrichPropertyListItems(uid, list);
  } else {
    list = sortPropertyDirectoryItems(list, sort);
    const totalCount = list.length;
    const from = (page - 1) * pageSize;
    const pageSlice = list.slice(from, from + pageSize);
    const enriched = await enrichPropertyListItems(uid, pageSlice);
    return { items: enriched, totalCount };
  }

  list = sortPropertyDirectoryItems(list, sort);
  const totalCount = list.length;
  const from = (page - 1) * pageSize;
  return { items: list.slice(from, from + pageSize), totalCount };
}
