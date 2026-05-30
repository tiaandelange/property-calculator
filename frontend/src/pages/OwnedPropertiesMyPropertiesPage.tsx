import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { AppListPage } from "../components/ui/AppPage";
import { Grid } from "../components/ui/Grid";
import { Card } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { getProperties } from "../api/ownedProperties";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
import { StatusPill } from "../components/ui/DashboardKit";

function occupancyDisplay(p: {
  occupancyStatus?: string;
  tenantStatus?: string;
  investmentType?: string;
  propertyType?: string;
}): { label: string; tone: "success" | "warning" | "info" | "accent" } {
  const typeKey = p.investmentType ?? p.propertyType;
  if (typeKey === "VACANT_LAND") return { label: "Land / no tenant required", tone: "accent" };
  if (typeKey === "SHORT_TERM_RENTAL") return { label: "Short-term rental", tone: "accent" };
  if (p.tenantStatus) {
    const tone =
      p.occupancyStatus === "OCCUPIED" ? "success" : p.occupancyStatus === "PARTIALLY_OCCUPIED" ? "info" : "warning";
    return { label: p.tenantStatus, tone };
  }
  if (p.occupancyStatus === "PARTIALLY_OCCUPIED") return { label: "Partially rented", tone: "info" };
  if (p.occupancyStatus === "OCCUPIED") return { label: "Occupied", tone: "success" };
  return { label: "Vacant", tone: "warning" };
}

function displayType(t: string | null | undefined) {
  const map: Record<string, string> = {
    LONG_TERM_RENTAL: "Long-Term Rental",
    SHORT_TERM_RENTAL: "Airbnb / Short-Term Rental",
    PRIMARY_RESIDENCE: "Primary Residence",
    HOUSE_HACK: "House Hack",
    BRRRR: "BRRRR Property",
    FLIP: "Flip / Renovation Project",
    VACANT_LAND: "Vacant Land",
    COMMERCIAL: "Commercial Property",
    MIXED_USE: "Mixed Use",
    OTHER: "Other"
  };
  return (t && map[t]) || t || "Other";
}

export function OwnedPropertiesMyPropertiesPage() {
  const { search } = useLocation();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>(new URLSearchParams(search).get("filter") ?? "ALL");
  const [sort, setSort] = useState<string>(new URLSearchParams(search).get("sort") ?? "RECENT");
  const [view, setView] = useState<"cards" | "list">((new URLSearchParams(search).get("view") as any) ?? "cards");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getProperties());
    } catch (e: any) {
      console.error("[MyProperties] Load failed", e);
      setError(e?.message ?? e?.response?.data?.message ?? "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  usePropertyWorkspaceRefresh({ onRefresh: () => void load() });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let next = [...rows];
    if (needle) {
      next = next.filter((p) => `${p.name ?? ""} ${p.addressLine1 ?? ""} ${p.city ?? ""}`.toLowerCase().includes(needle));
    }
    if (type !== "ALL") next = next.filter((p) => (p.investmentType ?? p.propertyType) === type);
    if (status !== "ALL") {
      next = next.filter((p) => {
        if (status === "OCCUPIED") return p.occupancyStatus === "OCCUPIED";
        if (status === "PARTIALLY_OCCUPIED") return p.occupancyStatus === "PARTIALLY_OCCUPIED";
        if (status === "VACANT") return p.occupancyStatus === "VACANT" && (p.investmentType ?? p.propertyType) !== "VACANT_LAND";
        if (status === "LAND") return (p.investmentType ?? p.propertyType) === "VACANT_LAND";
        if (status === "STR") return (p.investmentType ?? p.propertyType) === "SHORT_TERM_RENTAL";
        if (status === "RENOVATION") return (p.investmentType ?? p.propertyType) === "FLIP" || (p.investmentType ?? p.propertyType) === "BRRRR";
        return true;
      });
    }

    const asNum = (v: any) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
    const equity = (p: any) => {
      const v = asNum(p.currentEstimatedValue);
      const b = asNum(p.outstandingBondBalance);
      return v != null && b != null ? v - b : null;
    };

    const cashFlow = (p: any) => Number(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow ?? 0);
    const noi = (p: any) => Number(p.monthlyNOI ?? 0);
    const leaseEnd = (p: any) => (p.currentLease?.fixedTermEndDate ? new Date(p.currentLease.fixedTermEndDate).getTime() : Infinity);

    if (sort === "HIGHEST_NOI") next.sort((a, b) => noi(b) - noi(a));
    if (sort === "HIGHEST_EQUITY") next.sort((a, b) => (equity(b) ?? -Infinity) - (equity(a) ?? -Infinity));
    if (sort === "HIGHEST_CASH") next.sort((a, b) => cashFlow(b) - cashFlow(a));
    if (sort === "LOWEST_CASH") next.sort((a, b) => cashFlow(a) - cashFlow(b));
    if (sort === "URGENT_EXPIRIES") next.sort((a, b) => leaseEnd(a) - leaseEnd(b));
    if (sort === "OVERDUE_RENT") next.sort((a, b) => Number(Boolean(b.rentOverdue)) - Number(Boolean(a.rentOverdue)));
    if (sort === "RECENT") next.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return next;
  }, [rows, q, type, status, sort]);

  return (
    <AppListPage>
      <Helmet><title>My Properties | The Property Guy</title></Helmet>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            <ButtonLink href="/owned-properties/new" variant="primary">Add Property</ButtonLink>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <Card title="Filters">
          <div className="pg-workspace-filters-grid">
            <input className="pg-input" placeholder="Search name/address..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="pg-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ALL">All types</option>
              {["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "PRIMARY_RESIDENCE", "HOUSE_HACK", "BRRRR", "FLIP", "VACANT_LAND", "COMMERCIAL", "MIXED_USE", "OTHER"].map((t) => (
                <option key={t} value={t}>{displayType(t)}</option>
              ))}
            </select>
            <select className="pg-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="PARTIALLY_OCCUPIED">Partially rented</option>
              <option value="VACANT">Vacant</option>
              <option value="LAND">Land / No Tenant Required</option>
              <option value="STR">Short-Term Rental</option>
              <option value="RENOVATION">Under Renovation / Project</option>
            </select>
            <select className="pg-input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="RECENT">Recently added</option>
              <option value="HIGHEST_NOI">Highest NOI</option>
              <option value="HIGHEST_EQUITY">Highest equity</option>
              <option value="HIGHEST_CASH">Highest cash flow</option>
              <option value="LOWEST_CASH">Lowest cash flow</option>
              <option value="URGENT_EXPIRIES">Most urgent expiries</option>
              <option value="OVERDUE_RENT">Overdue rent</option>
            </select>
            <select className="pg-input" value={view} onChange={(e) => setView(e.target.value as any)}>
              <option value="cards">Card view</option>
              <option value="list">List view</option>
            </select>
          </div>
        </Card>
        {!loading && !error && rows.length === 0 ? (
          <Card title="Properties">
            <p className="pg-muted" style={{ marginTop: 0 }}>
              No properties were returned for your account. If you recently reset the database or ran migrations that recreate tables, your portfolio data may have been cleared—restore from a backup if you need it. Otherwise try{" "}
              <strong>logging out and logging in again</strong> so your session matches the current user record.
            </p>
            <ButtonLink href="/owned-properties/new" variant="primary" style={{ marginTop: 12, display: "inline-block" }}>
              Add a property
            </ButtonLink>
          </Card>
        ) : view === "list" ? (
          <Card title="Properties">
            {filtered.length === 0 ? (
              <div className="pg-muted">
                {rows.length === 0 ? "No properties to show." : "No properties match your filters."}
              </div>
            ) : (
              <div className="pg-workspace-inset-list">
                {filtered.map((p) => {
                  const typeKey = p.investmentType ?? p.propertyType;
                  const { label: statusLabel, tone } = occupancyDisplay(p);
                  const v = p.currentEstimatedValue;
                  const b = p.outstandingBondBalance;
                  const equity = v != null && b != null ? Number(v) - Number(b) : null;
                  const cash = Number(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow ?? 0);
                  const noi = Number(p.monthlyNOI ?? 0);
                  return (
                    <div key={p.id} className="pg-workspace-inset">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                        <div style={{ minWidth: 260 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                            <strong>{p.name}</strong>
                            <StatusPill label={statusLabel} tone={tone as any} />
                          </div>
                          <div className="pg-muted">{p.addressLine1}, {p.city}</div>
                          <div className="pg-muted" style={{ marginTop: 6 }}>{displayType(typeKey)}</div>
                        </div>
                        <div style={{ display: "grid", gap: 4, minWidth: 280 }}>
                          <div>Value: {v == null ? <span className="pg-muted">Missing</span> : `R ${Number(v).toLocaleString()}`}</div>
                          <div>Bond: {b == null ? <span className="pg-muted">Missing</span> : `R ${Number(b).toLocaleString()}`}</div>
                          <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                        </div>
                        <div style={{ display: "grid", gap: 4, minWidth: 280 }}>
                          <div>Monthly income: R {Number(p.monthlyIncome ?? 0).toLocaleString()}</div>
                          <div>Operating expenses: R {Number(p.monthlyOperatingExpenses ?? 0).toLocaleString()}</div>
                          <div>Monthly NOI: <strong style={{ color: noi >= 0 ? "var(--success)" : "var(--danger)" }}>R {noi.toLocaleString()}</strong></div>
                          <div>Monthly cash flow: <strong style={{ color: cash >= 0 ? "var(--success)" : "var(--danger)" }}>R {cash.toLocaleString()}</strong></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <ButtonLink href={`/owned-properties/${p.id}`} variant="ghost">View</ButtonLink>
                          <ButtonLink href={`/owned-properties/${p.id}?tab=financials`} variant="ghost">Financials</ButtonLink>
                          <ButtonLink href={`/owned-properties/${p.id}?tab=leases`} variant="ghost">Leases</ButtonLink>
                          <ButtonLink href={`/owned-properties/${p.id}?tab=documents`} variant="ghost">Documents</ButtonLink>
                        </div>
                      </div>
                      {(p.rentOverdue || p.leaseExpiringSoon || p.leaseMonthToMonth) ? (
                        <div className="pg-muted" style={{ marginTop: 8 }}>
                          Attention: {p.rentOverdue ? "overdue rent" : null}
                          {p.rentOverdue && (p.leaseExpiringSoon || p.leaseMonthToMonth) ? " · " : null}
                          {p.leaseExpiringSoon ? "lease expiring soon" : null}
                          {p.leaseExpiringSoon && p.leaseMonthToMonth ? " · " : null}
                          {p.leaseMonthToMonth ? "month-to-month lease" : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Grid cols={3}>
            {!loading && !error && rows.length > 0 && filtered.length === 0 ? (
              <div className="pg-muted" style={{ gridColumn: "1 / -1" }}>
                No properties match your filters. Clear filters or choose &quot;All&quot; for status and type.
              </div>
            ) : null}
            {filtered.map((p) => {
              const typeKey = p.investmentType ?? p.propertyType;
              const isLand = typeKey === "VACANT_LAND";
              const isStr = typeKey === "SHORT_TERM_RENTAL";
              const { label: statusLabel, tone } = occupancyDisplay(p);
              const v = p.currentEstimatedValue;
              const b = p.outstandingBondBalance;
              const equity = v != null && b != null ? Number(v) - Number(b) : null;
              const cash = Number(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow ?? 0);
              const noi = Number(p.monthlyNOI ?? 0);
              return (
                <div key={p.id} className="pg-property-card pg-workspace-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{p.name}</h3>
                      <div className="pg-muted">{p.addressLine1}, {p.city}</div>
                      <div className="pg-muted" style={{ marginTop: 6 }}>{displayType(typeKey)}</div>
                    </div>
                    <StatusPill label={statusLabel} tone={tone as any} />
                  </div>
                  <div className="pg-property-metrics" style={{ marginTop: 10 }}>
                    <div>Market value: {v == null ? <span className="pg-muted">Missing</span> : `R ${Number(v).toLocaleString()}`}</div>
                    <div>Bond: {b == null ? <span className="pg-muted">Missing</span> : `R ${Number(b).toLocaleString()}`}</div>
                    <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                    <div>Monthly NOI: <strong style={{ color: noi >= 0 ? "var(--success)" : "var(--danger)" }}>R {noi.toLocaleString()}</strong></div>
                    <div>Monthly cash flow: <strong style={{ color: cash >= 0 ? "var(--success)" : "var(--danger)" }}>R {cash.toLocaleString()}</strong></div>
                    <div>Tenant: {p.currentTenant?.firstName ? `${p.currentTenant.firstName} ${p.currentTenant.lastName}` : isLand || isStr ? <span className="pg-muted">Not required</span> : <span className="pg-muted">No tenant</span>}</div>
                    <div>Lease: {p.currentLease?.displayStatus ? p.currentLease.displayStatus : isLand || isStr ? <span className="pg-muted">Not required</span> : <span className="pg-muted">No lease</span>}</div>
                  </div>
                  {(p.rentOverdue || p.leaseExpiringSoon || p.leaseMonthToMonth) ? (
                    <div className="pg-alert" style={{ marginTop: 10 }}>
                      Needs attention: {p.rentOverdue ? "overdue rent" : null}
                      {p.rentOverdue && (p.leaseExpiringSoon || p.leaseMonthToMonth) ? " · " : null}
                      {p.leaseExpiringSoon ? "lease expiring soon" : null}
                      {p.leaseExpiringSoon && p.leaseMonthToMonth ? " · " : null}
                      {p.leaseMonthToMonth ? "month-to-month lease" : null}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <ButtonLink href={`/owned-properties/${p.id}`} variant="ghost">View</ButtonLink>
                    <ButtonLink href={`/owned-properties/${p.id}?tab=financials`} variant="ghost">Financials</ButtonLink>
                    <ButtonLink href={`/owned-properties/${p.id}?tab=leases`} variant="ghost">Leases</ButtonLink>
                    <ButtonLink href={`/owned-properties/${p.id}?tab=documents`} variant="ghost">Documents</ButtonLink>
                  </div>
                </div>
              );
            })}
          </Grid>
        )}
    </AppListPage>
  );
}

