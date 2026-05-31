import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppDetailPage } from "../components/ui/AppPage";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ButtonLink } from "../components/ui/Button";
import { TabPanelSkeleton, WorkspaceTabsSkeleton } from "../components/ui/PageSkeletons";
import { QueryErrorCard } from "../components/ui/QueryState";
import { cancelLease, createPropertyIncome, deleteLease } from "../api/ownedProperties";
import { WorkspaceTabs } from "../components/workspace/WorkspaceTabs";
import {
  invalidatePropertyQueries,
  isInitialQueryLoad,
  useDashboardSummaryQuery,
  usePropertyInvoicesQuery,
  usePropertyQuery,
  usePropertyReportsQuery,
  usePropertyStatementQuery,
  usePropertyTenantsQuery,
  useWorkspaceId
} from "../features/queries";
import { PROPERTY_WORKSPACE_TABS } from "../features/properties/workspace/propertyWorkspaceTabs";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { prefetchPropertyWorkspaceTabs } from "../lib/routePrefetch";
import { asArray } from "../lib/asArray";
import { WorkspaceFinancialsTab } from "../features/properties/workspace/WorkspaceFinancialsTab";
import { WorkspaceOverviewTab } from "../features/properties/workspace/WorkspaceOverviewTab";
import { WorkspaceStatementTab } from "../features/properties/workspace/WorkspaceStatementTab";
import { WorkspaceLinkTenantsTab } from "../features/properties/link-tenants/WorkspaceLinkTenantsTab";
import { CancelLeaseDialog } from "../features/properties/workspace/CancelLeaseDialog";
import { PropertyLeasesTable, type PropertyLeaseTableRow } from "../features/properties/workspace/PropertyLeasesTable";
import { leaseTenantLabel } from "../features/properties/workspace/PropertyLeaseCard";
import { ManualGenerateLeaseInvoiceFlow } from "../features/leases/ManualGenerateLeaseInvoiceFlow";
import { isCurrentLeaseStatus } from "../utils/leaseDisplay";

/** YYYY-MM in the user's local calendar (avoid UTC drift from `toISOString().slice(0, 7)`). */
function localCalendarMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const INV_SHORT: Record<string, string> = {
  LONG_TERM_RENTAL: "Long-term rental",
  SHORT_TERM_RENTAL: "Short-term rental",
  VACANT_LAND: "Vacant land",
  BRRRR: "BRRRR",
  FLIP: "Flip",
  PRIMARY_RESIDENCE: "Primary residence",
  COMMERCIAL: "Commercial",
  HOUSE_HACK: "House hack",
  MIXED_USE: "Mixed use",
  OTHER: "Other"
};

export function OwnedPropertyDetailPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [leaseDeleteTarget, setLeaseDeleteTarget] = useState<{ id: string | number; label: string } | null>(null);
  const [leaseCancelTarget, setLeaseCancelTarget] = useState<any>(null);
  const [leaseActionLoading, setLeaseActionLoading] = useState(false);
  const [leaseActionError, setLeaseActionError] = useState("");
  const [leaseHistoryOpen, setLeaseHistoryOpen] = useState(false);
  const [generateLeaseTarget, setGenerateLeaseTarget] = useState<any>(null);
  const tabRaw = useMemo(() => new URLSearchParams(search).get("tab") ?? "overview", [search]);
  const tab =
    tabRaw === "lease"
      ? "leases"
      : tabRaw === "performance"
        ? "reports"
        : tabRaw === "link-tenants"
          ? "tenants"
          : tabRaw;
  const finSub = useMemo(() => new URLSearchParams(search).get("fin") ?? "statement", [search]);
  const highlightLeaseId = useMemo(() => new URLSearchParams(search).get("leaseId"), [search]);
  const summaryMonth = useMemo(() => localCalendarMonth(), [id]);

  const needsTenants = tab === "leases" || tab === "tenants" || tab === "overview";
  const needsStatement = tab === "overview" || tab === "financials";
  const needsDashboard = tab === "overview";
  const needsInvoices = tab === "financials";
  const needsReports = tab === "reports";

  const propertyQuery = usePropertyQuery(id, { includeInvoices: false });
  const tenantsQuery = usePropertyTenantsQuery(id, { enabled: needsTenants });
  const invoicesQuery = usePropertyInvoicesQuery(id, { enabled: needsInvoices });
  const statementQuery = usePropertyStatementQuery(
    id,
    { month: summaryMonth, includeExpected: true },
    { enabled: needsStatement }
  );
  const dashboardQuery = useDashboardSummaryQuery(
    { propertyId: id ?? null, month: summaryMonth },
    { enabled: needsDashboard && Boolean(id) }
  );
  const reportsQuery = usePropertyReportsQuery(id, { enabled: needsReports });

  const data = useMemo((): any => {
    if (!propertyQuery.data) return null;
    return {
      ...(propertyQuery.data as Record<string, unknown>),
      tenants: asArray(tenantsQuery.data),
      invoices: needsInvoices ? asArray(invoicesQuery.data) : []
    };
  }, [propertyQuery.data, tenantsQuery.data, invoicesQuery.data, needsInvoices]);

  const perf = dashboardQuery.data ?? null;
  const stmt = statementQuery.data ?? null;
  const reportsCatalog = reportsQuery.data ?? null;
  const loading = isInitialQueryLoad(propertyQuery);
  const stmtLoading = needsStatement && isInitialQueryLoad(statementQuery);
  const overviewTabLoading =
    tab === "overview" &&
    ((needsDashboard && isInitialQueryLoad(dashboardQuery)) || (needsStatement && isInitialQueryLoad(statementQuery)));
  const reportsLoading = needsReports && isInitialQueryLoad(reportsQuery);
  const propertyLoadError = propertyQuery.error
    ? ((propertyQuery.error as Error).message ?? "Failed to load property.")
    : "";

  useEffect(() => {
    if (!id || !workspaceId || !propertyQuery.data) return;
    prefetchPropertyWorkspaceTabs({
      propertyId: id,
      workspaceId,
      queryClient,
      summaryMonth,
      activeTab: tab
    });
  }, [id, workspaceId, propertyQuery.data, summaryMonth, tab, queryClient]);

  const currentLeases = useMemo(() => {
    if (!data) return [];
    const raw = data.currentLeases;
    if (Array.isArray(raw) && raw.length) return raw;
    if (data.currentLease) return [data.currentLease];
    return asArray(data.leases).filter((l: any) => {
      const st = l.displayStatus ?? l.status;
      return st === "ACTIVE" || st === "MONTH_TO_MONTH";
    });
  }, [data]);

  const currentLeaseIdSet = useMemo(() => new Set(currentLeases.map((l: any) => String(l.id))), [currentLeases]);

  const historyLeases = useMemo(
    () => asArray(data?.leases).filter((l: any) => !currentLeaseIdSet.has(String(l.id))),
    [data?.leases, currentLeaseIdSet]
  );

  const combinedContractRent = useMemo(() => {
    const v = data?.combinedMonthlyRentFromLeases;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    return currentLeases.reduce((a: number, l: any) => a + Number(l.monthlyRent ?? 0), 0);
  }, [data, currentLeases]);

  const occupancySubtitle = useMemo(() => {
    if (!data) return "";
    const inv = data.investmentType as string | undefined;
    if (inv === "VACANT_LAND") return "Vacant land · No tenant required";
    if (inv === "SHORT_TERM_RENTAL") return "Short-term rental";
    if (inv === "FLIP") return "Flip / renovation project";
    if (currentLeases.length === 0) return "Vacant";
    const m2m = currentLeases.some((l: any) => (l.displayStatus ?? l.status) === "MONTH_TO_MONTH");
    if (m2m) return "Occupied · Month-to-month";
    return "Occupied · Active lease";
  }, [data, currentLeases]);

  const tenantIdsWithCurrentLease = useMemo(
    () => new Set(currentLeases.map((l: any) => String(l.tenantId ?? "")).filter(Boolean)),
    [currentLeases]
  );

  const titleAddress = useMemo(() => {
    if (!data) return "";
    const line = [data.addressLine1, data.city].filter(Boolean).join(", ");
    return line || data.name || "";
  }, [data]);

  const refreshAfterMutation = async () => {
    if (!id) return;
    invalidatePropertyQueries({ workspaceId, propertyId: id });
    invalidatePropertyWorkspace(id);
    await queryClient.invalidateQueries({ queryKey: ["property", id] });
  };

  useEffect(() => {
    if (!highlightLeaseId || !data) return;
    const inCurrent = currentLeases.some((l: any) => String(l.id) === highlightLeaseId);
    if (!inCurrent) setLeaseHistoryOpen(true);
  }, [highlightLeaseId, data, currentLeases]);

  useEffect(() => {
    if (tab !== "leases" || !highlightLeaseId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`lease-card-${highlightLeaseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, leaseHistoryOpen ? 100 : 0);
    return () => window.clearTimeout(timer);
  }, [tab, highlightLeaseId, data, leaseHistoryOpen]);

  const confirmHardDeleteLease = async () => {
    if (!leaseDeleteTarget) return;
    setLeaseActionLoading(true);
    setLeaseActionError("");
    try {
      await deleteLease(leaseDeleteTarget.id);
      setLeaseDeleteTarget(null);
      await refreshAfterMutation();
    } catch (e: any) {
      setLeaseActionError(e?.response?.data?.message ?? e?.message ?? "Failed to delete lease.");
    } finally {
      setLeaseActionLoading(false);
    }
  };

  const confirmCancelLease = async (payload: { cancellationDate: string; cancellationReason?: string }) => {
    if (!leaseCancelTarget?.id) return;
    setLeaseActionLoading(true);
    setLeaseActionError("");
    try {
      await cancelLease(leaseCancelTarget.id, {
        cancellationDate: payload.cancellationDate,
        cancellationReason: payload.cancellationReason,
        cancelledBy: "LANDLORD"
      });
      setLeaseCancelTarget(null);
      await refreshAfterMutation();
    } catch (e: any) {
      setLeaseActionError(e?.response?.data?.message ?? e?.message ?? "Failed to cancel lease.");
    } finally {
      setLeaseActionLoading(false);
    }
  };

  useEffect(() => {
    if (!highlightLeaseId || tab !== "leases") return;
    const el = document.getElementById(`lease-row-${highlightLeaseId}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightLeaseId, tab, currentLeases, historyLeases]);

  const canGenerateInvoiceForLease = (lease: { displayStatus?: string; status?: string; tenantId?: unknown }) =>
    isCurrentLeaseStatus(String(lease.displayStatus ?? lease.status ?? "")) && Boolean(lease.tenantId);

  const openLeaseDelete = (lease: { id?: string | number; tenant?: unknown; tenantId?: unknown }) => {
    if (lease.id == null) return;
    setLeaseActionError("");
    const tn =
      (lease as { tenant?: { firstName?: string; lastName?: string } }).tenant ??
      data?.tenants?.find((t: { id?: unknown }) => String(t.id) === String(lease.tenantId));
    const name = tn
      ? `${(tn as { firstName?: string }).firstName ?? ""} ${(tn as { lastName?: string }).lastName ?? ""}`.trim()
      : "this lease";
    setLeaseDeleteTarget({ id: lease.id, label: name || `lease #${lease.id}` });
  };

  const onEditLease = (lease: { id?: string | number }) => {
    if (lease?.id == null) return;
    navigate(`/leases/${lease.id}/edit`);
  };

  const onAddReceivedIncomeForTenant = async (tenantId: string | number) => {
    if (!id) return;
    const amount = window.prompt("Amount received (number)", "");
    if (!amount) return;
    const incomeDate = window.prompt("Income date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!incomeDate) return;
    try {
      await createPropertyIncome(id, {
        tenantId,
        category: "RENT",
        description: "Rent received",
        amount: Number(amount),
        incomeDate,
        source: "MANUAL_FINANCIAL_ENTRY",
        status: "RECEIVED"
      });
      await refreshAfterMutation();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? e?.message ?? "Failed to add income.");
    }
  };

  return (
    <>
      <AppDetailPage>
        <Helmet>
          <title>{data?.name ? `${data.name} | Property` : "Property Detail | The Property Guy"}</title>
        </Helmet>
        {propertyLoadError && !propertyQuery.data ? (
          <QueryErrorCard
            message={propertyLoadError}
            onRetry={() => void propertyQuery.refetch()}
            retrying={propertyQuery.isFetching}
          />
        ) : null}
        {loading ? (
          <>
            <WorkspaceTabsSkeleton />
            <div className="pg-workspace-panel">
              <TabPanelSkeleton variant="overview" />
            </div>
          </>
        ) : data ? (
          <>
            {tab !== "overview" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 8,
                  marginBottom: 12
                }}
              >
                <WorkspaceTabs
                  basePath={`/owned-properties/${id}`}
                  active={tab === "financials" && finSub === "invoice" ? "financials" : tab}
                  tabs={[...PROPERTY_WORKSPACE_TABS]}
                  extraQueryForTab={{ financials: `fin=${encodeURIComponent(finSub)}` }}
                  style={{ marginBottom: 0 }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <ButtonLink
                    href={`/owned-properties/${id}/report`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="soft"
                  >
                    Generate report
                  </ButtonLink>
                  <ButtonLink href={`/owned-properties/${id}/edit`} variant="soft">
                    Edit Property
                  </ButtonLink>
                </div>
              </div>
            ) : null}

            <div className={tab === "overview" ? undefined : "pg-workspace-panel"}>
              {tab === "overview" ? (
                overviewTabLoading ? (
                  <TabPanelSkeleton variant="overview" />
                ) : (
                  <WorkspaceOverviewTab
                    data={data}
                    statement={stmt}
                    perf={perf}
                    propertyId={id!}
                    navigate={(path) => navigate(path)}
                    currentLeases={currentLeases}
                    combinedContractRent={combinedContractRent}
                    finSub={finSub}
                    activeTab={tab}
                  />
                )
              ) : null}

              {tab === "financials" && id ? (
                stmtLoading ? (
                  <TabPanelSkeleton variant="table" />
                ) : (
                  <WorkspaceFinancialsTab
                    propertyId={id}
                    finSub={finSub}
                    statement={stmt}
                    loading={stmtLoading}
                    onReload={refreshAfterMutation}
                    currentLeases={currentLeases}
                    propertyInvoices={data?.invoices ?? []}
                    propertyDetail={data ?? null}
                  />
                )
              ) : null}

              {tab === "statement" && id ? (
                <WorkspaceStatementTab propertyId={id} />
              ) : null}

              {tab === "tenants" && id ? (
                <WorkspaceLinkTenantsTab propertyId={id} property={data} onRefresh={refreshAfterMutation} />
              ) : null}

              {tab === "leases" ? (
                <div className="pg-workspace-inset-list pg-property-leases-tab">
                  <section className="pg-leases-list-panel pg-workspace-card">
                    <div className="pg-property-leases-tab__head">
                      <h2 className="pg-property-leases-tab__title">Current leases</h2>
                      <ButtonLink href={`/leases/new?propertyId=${id}`} variant="primary">
                        Add lease
                      </ButtonLink>
                    </div>
                    <PropertyLeasesTable
                      leases={currentLeases as PropertyLeaseTableRow[]}
                      fallbackTenants={data?.tenants}
                      highlightLeaseId={highlightLeaseId}
                      emptyMessage="No current lease linked to this property."
                      showEdit
                      showCancel
                      showDelete
                      canGenerateInvoiceForLease={canGenerateInvoiceForLease}
                      onGenerateInvoice={(lease) => setGenerateLeaseTarget(lease)}
                      onEdit={onEditLease}
                      onCancel={(lease) => {
                        setLeaseActionError("");
                        setLeaseCancelTarget(lease);
                      }}
                      onDelete={openLeaseDelete}
                    />
                  </section>

                  <details
                    className="pg-property-leases-history"
                    open={leaseHistoryOpen || undefined}
                    onToggle={(e) => setLeaseHistoryOpen((e.target as HTMLDetailsElement).open)}
                  >
                    <summary className="pg-property-leases-history__summary">Lease history</summary>
                    <section className="pg-leases-list-panel pg-workspace-card" style={{ marginTop: 12 }}>
                      <PropertyLeasesTable
                        leases={historyLeases as PropertyLeaseTableRow[]}
                        fallbackTenants={data?.tenants}
                        highlightLeaseId={highlightLeaseId}
                        emptyMessage="No historical leases."
                        showDelete
                        canGenerateInvoiceForLease={canGenerateInvoiceForLease}
                        onGenerateInvoice={(lease) => setGenerateLeaseTarget(lease)}
                        onEdit={onEditLease}
                        onDelete={openLeaseDelete}
                        resolveShowEdit={(l) =>
                          !["CANCELLED", "TERMINATED", "ARCHIVED"].includes(String(l.status ?? "").toUpperCase())
                        }
                        resolveShowDelete={(l) =>
                          !["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.displayStatus ?? l.status ?? "").toUpperCase())
                        }
                      />
                    </section>
                  </details>
                </div>
              ) : null}

              {tab === "documents" ? (
                <div className="pg-workspace-inset-list">
                  <div className="pg-muted">{data.documents?.length ?? 0} documents.</div>
                  <ButtonLink href="/documents" variant="ghost">
                    Open documents
                  </ButtonLink>
                </div>
              ) : null}

              {tab === "reports" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <Card title="Property-level reports">
                    <div className="pg-muted" style={{ marginBottom: 12 }}>
                      Uses the same canonical statement and aggregates as Overview and Financials.
                    </div>
                    {reportsLoading ? (
                      <TabPanelSkeleton variant="default" />
                    ) : asArray(reportsCatalog?.reports).length ? (
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                        {asArray(reportsCatalog?.reports).map((r: any) => (
                          <li key={r.id} className="pg-workspace-inset">
                            <div style={{ fontWeight: 600 }}>{r.title}</div>
                            <div className="pg-muted" style={{ fontSize: 13, marginTop: 4 }}>
                              {r.description}
                            </div>
                            <div style={{ marginTop: 10 }}>
                              {r.href ? (
                                <ButtonLink href={r.href} variant="primary">
                                  Open
                                </ButtonLink>
                              ) : (
                                <ButtonLink
                                  href={`/owned-properties/${id}?tab=${r.tab}${r.tab === "financials" ? "&fin=statement" : ""}`}
                                  variant="primary"
                                >
                                  Go to workspace
                                </ButtonLink>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="pg-muted">Reports catalog unavailable.</div>
                    )}
                  </Card>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </AppDetailPage>

      <ConfirmDialog
        open={leaseDeleteTarget != null}
        title="Delete lease permanently?"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={leaseActionLoading}
        onClose={() => {
          if (!leaseActionLoading) setLeaseDeleteTarget(null);
        }}
        onConfirm={() => void confirmHardDeleteLease()}
      >
        <p style={{ marginTop: 0 }}>
          Permanently delete <strong>{leaseDeleteTarget?.label}</strong>? This removes the lease property/unit link and
          associated lease financial history (invoices, income, recurring rules). The tenant record will remain in Global
          Tenants.
        </p>
        <p className="pg-muted" style={{ fontSize: 13, marginBottom: 0 }}>
          To keep lease history and financial records, cancel the lease instead.
        </p>
        {leaseActionError ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{leaseActionError}</div> : null}
      </ConfirmDialog>

      <CancelLeaseDialog
        open={leaseCancelTarget != null}
        leaseLabel={leaseCancelTarget ? leaseTenantLabel(leaseCancelTarget, data?.tenants) : undefined}
        errorMessage={leaseCancelTarget ? leaseActionError : undefined}
        loading={leaseActionLoading}
        onClose={() => {
          if (!leaseActionLoading) {
            setLeaseCancelTarget(null);
            setLeaseActionError("");
          }
        }}
        onConfirm={(payload) => void confirmCancelLease(payload)}
      />

      {generateLeaseTarget ? (
        <ManualGenerateLeaseInvoiceFlow
          open={Boolean(generateLeaseTarget)}
          leaseId={String(generateLeaseTarget.id)}
          tenantId={String(generateLeaseTarget.tenantId ?? "")}
          propertyId={String(id ?? generateLeaseTarget.propertyId ?? "")}
          monthlyRent={Number(generateLeaseTarget.monthlyRent ?? 0)}
          rentDueDay={Number(generateLeaseTarget.rentDueDay ?? 1)}
          onClose={() => setGenerateLeaseTarget(null)}
        />
      ) : null}
    </>
  );
}
