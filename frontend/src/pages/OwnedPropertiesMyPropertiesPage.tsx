import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { AppListPage } from "../components/ui/AppPage";
import { Grid } from "../components/ui/Grid";
import { Card, WorkspaceFilterCard } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import {
  isInitialQueryLoad,
  isQueryRefreshing,
  queryKeys,
  usePropertiesDirectoryQuery,
  useWorkspaceId
} from "../features/queries";
import { prefetchPropertyFromList, listWarmHandlers } from "../lib/routePrefetch";
import { propertyListCardFinancials } from "../features/properties/financials/propertyFinancialsAdapter";
import { StatusPill } from "../components/ui/DashboardKit";
import { MetricCardsSkeletonRow, MobileCardListSkeleton, PropertyCardsSkeletonGrid } from "../components/ui/PageSkeletons";
import { QueryErrorCard, QueryRefreshingIndicator } from "../components/ui/QueryState";
import { LeasePagination } from "../features/leases/LeasePagination";
import { PROPERTIES_DIRECTORY_PAGE_SIZE } from "../features/properties/propertiesDirectoryUtils";

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
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(() => new URLSearchParams(search).get("q") ?? "");
  const [type, setType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>(new URLSearchParams(search).get("filter") ?? "ALL");
  const [sort, setSort] = useState<string>(new URLSearchParams(search).get("sort") ?? "RECENT");
  const [view, setView] = useState<"cards" | "list">((new URLSearchParams(search).get("view") as "cards" | "list") ?? "cards");

  const directoryParams = useMemo(
    () => ({
      page,
      pageSize: PROPERTIES_DIRECTORY_PAGE_SIZE,
      q,
      type,
      status,
      sort
    }),
    [page, q, type, status, sort]
  );

  const directoryQuery = usePropertiesDirectoryQuery(directoryParams);
  const filtered = (directoryQuery.data?.items ?? []) as Record<string, unknown>[];
  const totalCount = directoryQuery.data?.totalCount ?? 0;
  const loading = isInitialQueryLoad(directoryQuery);
  const refreshing = isQueryRefreshing(directoryQuery);
  const error = directoryQuery.error
    ? (directoryQuery.error as Error).message ?? "Failed to load properties."
    : "";

  useEffect(() => {
    setPage(1);
  }, [q, type, status, sort]);

  useEffect(() => {
    const urlQ = new URLSearchParams(search).get("q") ?? "";
    setQ(urlQ);
  }, [search]);

  const warmProperty = (propertyId: string) => {
    prefetchPropertyFromList(propertyId, queryClient, workspaceId ?? null);
  };
  const propertyWarmProps = (propertyId: string) => listWarmHandlers(() => warmProperty(propertyId));

  const hasFilters = q.trim() !== "" || type !== "ALL" || status !== "ALL";

  return (
    <AppListPage>
      <Helmet>
        <title>My Properties | The Property Guy</title>
      </Helmet>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <QueryRefreshingIndicator active={refreshing} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            onClick={() => {
              if (workspaceId) {
                void queryClient.invalidateQueries({ queryKey: queryKeys.propertiesDirectory(workspaceId) });
                void queryClient.invalidateQueries({ queryKey: queryKeys.properties(workspaceId) });
              }
            }}
            loading={directoryQuery.isFetching && !loading}
          >
            Refresh
          </Button>
          <ButtonLink href="/owned-properties/new" variant="primary">
            Add Property
          </ButtonLink>
        </div>
      </div>

      {error ? (
        <QueryErrorCard
          message={error}
          onRetry={() => {
            if (workspaceId) void queryClient.invalidateQueries({ queryKey: queryKeys.propertiesDirectory(workspaceId) });
          }}
          retrying={directoryQuery.isFetching}
        />
      ) : null}
      <WorkspaceFilterCard>
        <div className="pg-workspace-filters-grid">
          <input className="pg-input" placeholder="Search name/address..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="pg-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ALL">All types</option>
            {["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "PRIMARY_RESIDENCE", "HOUSE_HACK", "BRRRR", "FLIP", "VACANT_LAND", "COMMERCIAL", "MIXED_USE", "OTHER"].map((t) => (
              <option key={t} value={t}>
                {displayType(t)}
              </option>
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
          <select className="pg-input" value={view} onChange={(e) => setView(e.target.value as "cards" | "list")}>
            <option value="cards">Card view</option>
            <option value="list">List view</option>
          </select>
        </div>
      </WorkspaceFilterCard>
      {!loading && !error && totalCount === 0 && !hasFilters ? (
        <Card title="Properties">
          <p className="pg-muted" style={{ marginTop: 0 }}>
            No properties were returned for your account. If you recently reset the database or ran migrations that recreate tables, your portfolio data may have been cleared—restore from a backup if you need it. Otherwise try{" "}
            <strong>logging out and logging in again</strong> so your session matches the current user record.
          </p>
          <ButtonLink href="/owned-properties/new" variant="primary" style={{ marginTop: 12, display: "inline-block" }}>
            Add a property
          </ButtonLink>
        </Card>
      ) : loading ? (
        view === "list" ? (
          <Card title="Properties">
            <MobileCardListSkeleton count={5} />
          </Card>
        ) : (
          <PropertyCardsSkeletonGrid count={6} />
        )
      ) : view === "list" ? (
        <Card title="Properties">
          {filtered.length === 0 ? (
            <div className="pg-muted">No properties match your filters.</div>
          ) : (
            <div className="pg-workspace-inset-list">
              {filtered.map((p) => {
                const typeKey = (p.investmentType ?? p.propertyType) as string | undefined;
                const { label: statusLabel, tone } = occupancyDisplay(p as Parameters<typeof occupancyDisplay>[0]);
                const fin = propertyListCardFinancials(p);
                const v = p.currentEstimatedValue;
                const b = p.outstandingBondBalance;
                const equity = v != null && b != null ? Number(v) - Number(b) : null;
                const { monthlyNOI: noi, monthlyCashFlow: cash } = fin;
                const currentTenant = p.currentTenant as { firstName?: string; lastName?: string } | null | undefined;
                return (
                  <div key={String(p.id)} className="pg-workspace-inset" {...propertyWarmProps(String(p.id))}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                      <div style={{ minWidth: 260 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                          <strong>{String(p.name ?? "")}</strong>
                          <StatusPill label={statusLabel} tone={tone as "success" | "warning" | "info" | "accent"} />
                        </div>
                        <div className="pg-muted">
                          {String(p.addressLine1 ?? "")}, {String(p.city ?? "")}
                        </div>
                        <div className="pg-muted" style={{ marginTop: 6 }}>
                          {displayType(typeKey)}
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 4, minWidth: 280 }}>
                        <div>Value: {v == null ? <span className="pg-muted">Missing</span> : `R ${Number(v).toLocaleString()}`}</div>
                        <div>Bond: {b == null ? <span className="pg-muted">Missing</span> : `R ${Number(b).toLocaleString()}`}</div>
                        <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                      </div>
                      <div style={{ display: "grid", gap: 4, minWidth: 280 }}>
                        <div>Monthly income: R {fin.monthlyIncome.toLocaleString()}</div>
                        <div>Operating expenses: R {fin.monthlyOperatingExpenses.toLocaleString()}</div>
                        <div>
                          Monthly NOI:{" "}
                          <strong style={{ color: noi >= 0 ? "var(--success)" : "var(--danger)" }}>R {noi.toLocaleString()}</strong>
                        </div>
                        <div>
                          Monthly cash flow:{" "}
                          <strong style={{ color: cash >= 0 ? "var(--success)" : "var(--danger)" }}>R {cash.toLocaleString()}</strong>
                          <span className="pg-muted" style={{ fontSize: 12 }}> (after bond)</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <ButtonLink href={`/owned-properties/${p.id}`} variant="ghost" {...propertyWarmProps(String(p.id))}>
                          View
                        </ButtonLink>
                        <ButtonLink href={`/owned-properties/${p.id}?tab=financials`} variant="ghost">
                          Financials
                        </ButtonLink>
                        <ButtonLink href={`/owned-properties/${p.id}?tab=leases`} variant="ghost">
                          Leases
                        </ButtonLink>
                        <ButtonLink href={`/owned-properties/${p.id}?tab=documents`} variant="ghost">
                          Documents
                        </ButtonLink>
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
          <LeasePagination
            page={page}
            totalItems={totalCount}
            pageSize={PROPERTIES_DIRECTORY_PAGE_SIZE}
            onPageChange={setPage}
          />
        </Card>
      ) : (
        <>
          <Grid cols={3}>
            {!loading && !error && totalCount > 0 && filtered.length === 0 ? (
              <div className="pg-muted" style={{ gridColumn: "1 / -1" }}>
                No properties match your filters. Clear filters or choose &quot;All&quot; for status and type.
              </div>
            ) : null}
            {filtered.map((p) => {
              const typeKey = (p.investmentType ?? p.propertyType) as string | undefined;
              const isLand = typeKey === "VACANT_LAND";
              const isStr = typeKey === "SHORT_TERM_RENTAL";
              const { label: statusLabel, tone } = occupancyDisplay(p as Parameters<typeof occupancyDisplay>[0]);
              const fin = propertyListCardFinancials(p);
              const v = p.currentEstimatedValue;
              const b = p.outstandingBondBalance;
              const equity = v != null && b != null ? Number(v) - Number(b) : null;
              const { monthlyNOI: noi, monthlyCashFlow: cash } = fin;
              const currentLease = p.currentLease as { displayStatus?: string } | null | undefined;
              const currentTenant = p.currentTenant as { firstName?: string; lastName?: string } | null | undefined;
              return (
                <div key={String(p.id)} className="pg-property-card pg-workspace-card" {...propertyWarmProps(String(p.id))}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{String(p.name ?? "")}</h3>
                      <div className="pg-muted">
                        {String(p.addressLine1 ?? "")}, {String(p.city ?? "")}
                      </div>
                      <div className="pg-muted" style={{ marginTop: 6 }}>
                        {displayType(typeKey)}
                      </div>
                    </div>
                    <StatusPill label={statusLabel} tone={tone as "success" | "warning" | "info" | "accent"} />
                  </div>
                  <div className="pg-property-metrics" style={{ marginTop: 10 }}>
                    <div>Market value: {v == null ? <span className="pg-muted">Missing</span> : `R ${Number(v).toLocaleString()}`}</div>
                    <div>Bond: {b == null ? <span className="pg-muted">Missing</span> : `R ${Number(b).toLocaleString()}`}</div>
                    <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                    <div>
                      Monthly NOI:{" "}
                      <strong style={{ color: noi >= 0 ? "var(--success)" : "var(--danger)" }}>R {noi.toLocaleString()}</strong>
                    </div>
                    <div>
                      Monthly cash flow:{" "}
                      <strong style={{ color: cash >= 0 ? "var(--success)" : "var(--danger)" }}>R {cash.toLocaleString()}</strong>
                      <span className="pg-muted" style={{ fontSize: 12 }}> (after bond)</span>
                    </div>
                    <div>
                      Tenant:{" "}
                      {currentTenant?.firstName ? `${currentTenant.firstName} ${currentTenant.lastName ?? ""}` : isLand || isStr ? (
                        <span className="pg-muted">Not required</span>
                      ) : (
                        <span className="pg-muted">No tenant</span>
                      )}
                    </div>
                    <div>
                      Lease:{" "}
                      {currentLease?.displayStatus ? (
                        currentLease.displayStatus
                      ) : isLand || isStr ? (
                        <span className="pg-muted">Not required</span>
                      ) : (
                        <span className="pg-muted">No lease</span>
                      )}
                    </div>
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
                    <ButtonLink href={`/owned-properties/${p.id}`} variant="ghost" {...propertyWarmProps(String(p.id))}>
                      View
                    </ButtonLink>
                    <ButtonLink href={`/owned-properties/${p.id}?tab=financials`} variant="ghost">
                      Financials
                    </ButtonLink>
                    <ButtonLink href={`/owned-properties/${p.id}?tab=leases`} variant="ghost">
                      Leases
                    </ButtonLink>
                    <ButtonLink href={`/owned-properties/${p.id}?tab=documents`} variant="ghost">
                      Documents
                    </ButtonLink>
                  </div>
                </div>
              );
            })}
          </Grid>
          <section className="pg-workspace-card pg-leases-pagination-panel" style={{ marginTop: 16 }}>
            <LeasePagination
              page={page}
              totalItems={totalCount}
              pageSize={PROPERTIES_DIRECTORY_PAGE_SIZE}
              onPageChange={setPage}
            />
          </section>
        </>
      )}
    </AppListPage>
  );
}
