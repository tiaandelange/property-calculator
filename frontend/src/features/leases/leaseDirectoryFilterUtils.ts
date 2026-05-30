/** YYYY-MM-DD in local calendar for PostgREST date filters. */
export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function hasLeaseSearchQuery(q: string | undefined): boolean {
  return Boolean(q?.trim());
}

/** Best-effort SQL lifecycle filter aligned with `deriveLeaseStatus`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLeaseLifecycleSqlFilter(query: any, lifecycle: string | undefined, today = localYmd()) {
  const s = String(lifecycle ?? "ALL");
  if (s === "ALL") return query;
  const in30 = addDaysYmd(today, 30);

  if (s === "expired") {
    return query.in("status", ["EXPIRED", "TERMINATED", "CANCELLED"]);
  }
  if (s === "inactive") {
    return query.not("status", "in", '("ACTIVE","MONTH_TO_MONTH","EXPIRED","TERMINATED","CANCELLED")');
  }
  if (s === "notice") {
    return query.eq("status", "ACTIVE").not("fixed_term_end_date", "is", null).lt("fixed_term_end_date", today);
  }
  if (s === "ending_soon") {
    return query
      .in("status", ["ACTIVE", "MONTH_TO_MONTH"])
      .not("fixed_term_end_date", "is", null)
      .gte("fixed_term_end_date", today)
      .lte("fixed_term_end_date", in30);
  }
  if (s === "active") {
    return query
      .in("status", ["ACTIVE", "MONTH_TO_MONTH"])
      .or(`fixed_term_end_date.is.null,fixed_term_end_date.gt.${in30},status.eq.MONTH_TO_MONTH`);
  }
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLeaseSearchSqlFilter(query: any, q: string | undefined) {
  const needle = q?.trim();
  if (!needle) return query;
  const pattern = `%${needle.replace(/%/g, "\\%")}%`;
  return query.or(
    `lease_reference.ilike.${pattern},tenants.first_name.ilike.${pattern},tenants.last_name.ilike.${pattern},properties.name.ilike.${pattern}`
  );
}

const LEASE_METRICS_SELECT =
  "id, status, monthly_rent, fixed_term_end_date, start_date, lease_type, tenant_id, property_id";

export { LEASE_METRICS_SELECT };
