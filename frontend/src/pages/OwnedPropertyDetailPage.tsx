import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  cancelLease,
  createPropertyIncome,
  deleteLease,
  getProperty,
  getPropertyTenants,
  getPropertyStatement,
  getPropertyWorkspaceReports,
  getPortfolioDashboardSummary
} from "../api/ownedProperties";
import { WorkspaceTabs } from "../components/workspace/WorkspaceTabs";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
import { WorkspaceFinancialsTab } from "../features/properties/workspace/WorkspaceFinancialsTab";
import { WorkspaceOverviewTab } from "../features/properties/workspace/WorkspaceOverviewTab";
import { WorkspaceStatementTab } from "../features/properties/workspace/WorkspaceStatementTab";
import { WorkspaceLinkTenantsTab } from "../features/properties/link-tenants/WorkspaceLinkTenantsTab";
import { CancelLeaseDialog } from "../features/properties/workspace/CancelLeaseDialog";
import { PropertyLeaseCard, leaseTenantLabel } from "../features/properties/workspace/PropertyLeaseCard";
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
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [perf, setPerf] = useState<any>(null);
  const [stmt, setStmt] = useState<any>(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [reportsCatalog, setReportsCatalog] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
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
  const prevTabRef = useRef<string | null>(null);
  /** Ignore out-of-order responses when multiple loadAll() runs overlap (fixes stale Overview after Financials edits). */
  const loadSeqRef = useRef(0);

  const currentLeases = useMemo(() => {
    if (!data) return [];
    const raw = data.currentLeases;
    if (Array.isArray(raw) && raw.length) return raw;
    if (data.currentLease) return [data.currentLease];
    return (data.leases ?? []).filter((l: any) => {
      const st = l.displayStatus ?? l.status;
      return st === "ACTIVE" || st === "MONTH_TO_MONTH";
    });
  }, [data]);

  const currentLeaseIdSet = useMemo(() => new Set(currentLeases.map((l: any) => String(l.id))), [currentLeases]);

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

  const loadAll = useCallback(async () => {
    if (!id) return;
    const seq = ++loadSeqRef.current;
    try {
      setError("");
      setStmtLoading(true);
      const summaryMonth = localCalendarMonth();
      const ledgerOutcomePromise = getPropertyStatement(id, { bustCache: true, month: summaryMonth }).then(
        (ledger) => ({ ok: true as const, ledger }),
        () => ({ ok: false as const })
      );
      const dashboardPropertyId = id ?? null;
      const dashPromise = getPortfolioDashboardSummary({
        propertyId: dashboardPropertyId,
        month: summaryMonth,
        bustCache: true
      });
      const [prop, dash, ledgerOutcome, propTenants] = await Promise.all([
        getProperty(id, { bustCache: true, month: summaryMonth }),
        dashPromise,
        ledgerOutcomePromise,
        getPropertyTenants(id)
      ]);
      if (seq !== loadSeqRef.current) return;
      setData({ ...prop, tenants: propTenants });
      setPerf(dash);
      setStmt((prev: any) => (ledgerOutcome.ok ? ledgerOutcome.ledger : prev));
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load property.");
    } finally {
      if (seq === loadSeqRef.current) setStmtLoading(false);
    }
  }, [id]);

  useEffect(() => {
    prevTabRef.current = null;
  }, [id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!id) return;
    const prev = prevTabRef.current;
    prevTabRef.current = tab;
    if (tab === "overview" && prev !== null && prev !== "overview") {
      void loadAll();
    }
  }, [id, tab, loadAll]);

  useEffect(() => {
    if (!id || tab !== "reports") return;
    setReportsLoading(true);
    void (async () => {
      try {
        setReportsCatalog(await getPropertyWorkspaceReports(id));
      } catch {
        setReportsCatalog(null);
      } finally {
        setReportsLoading(false);
      }
    })();
  }, [id, tab]);

  usePropertyWorkspaceRefresh({ propertyId: id, onRefresh: () => void loadAll() });

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

  const refreshAfterMutation = async () => {
    await loadAll();
    if (id) invalidatePropertyWorkspace(id);
  };

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

  const onEditLease = (lease: { id?: string }) => {
    if (!lease?.id) return;
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
    <Section>
      <Helmet>
        <title>{data?.name ? `${data.name} | Property` : "Property Detail | The Property Guy"}</title>
      </Helmet>
      <Container>
        {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
        {data ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 8, marginBottom: 12 }}>
              <WorkspaceTabs
                basePath={`/owned-properties/${id}`}
                active={tab}
                tabs={[
                  { key: "overview", label: "Overview" },
                  { key: "financials", label: "Financials" },
                  { key: "statement", label: "Statement" },
                  { key: "tenants", label: "Tenants" },
                  { key: "leases", label: "Leases" },
                  { key: "documents", label: "Documents" },
                  {
                    key: "reports",
                    label: (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        Generate report <ExternalLink size={16} aria-hidden />
                      </span>
                    ),
                    to: `/owned-properties/${id}/report`,
                    newTab: true,
                    variant: "secondary"
                  }
                ]}
                extraQueryForTab={{ financials: `fin=${encodeURIComponent(finSub)}` }}
                style={{ marginBottom: 0 }}
              />
              <Link className="pg-btn pg-btn-secondary" to={`/owned-properties/${id}/edit`}>
                Edit Property
              </Link>
            </div>

            <div className="pg-workspace-panel">
              {tab === "overview" ? (
                <WorkspaceOverviewTab
                  data={data}
                  statement={stmt}
                  perf={perf}
                  propertyId={id!}
                  navigate={(path) => navigate(path)}
                  currentLeases={currentLeases}
                  combinedContractRent={combinedContractRent}
                />
              ) : null}

              {tab === "financials" && id ? (
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
              ) : null}

              {tab === "statement" && id ? (
                <WorkspaceStatementTab propertyId={id} />
              ) : null}

              {tab === "tenants" && id ? (
                <WorkspaceLinkTenantsTab propertyId={id} property={data} onRefresh={refreshAfterMutation} />
              ) : null}

              {tab === "leases" ? (
                <div className="pg-workspace-inset-list">
                  {currentLeases.length > 0 ? (
                    <div className="pg-workspace-card-stack">
                      {currentLeases.map((lease: any) => (
                        <PropertyLeaseCard
                          key={lease.id}
                          lease={lease}
                          fallbackTenants={data.tenants}
                          cardId={`lease-card-${lease.id}`}
                          highlighted={highlightLeaseId === String(lease.id)}
                          showEdit
                          showCancel
                          showDelete
                          canGenerateInvoice={
                            isCurrentLeaseStatus(String(lease.displayStatus ?? lease.status ?? "")) &&
                            Boolean(lease.tenantId)
                          }
                          onGenerateInvoice={() => setGenerateLeaseTarget(lease)}
                          onEdit={() => onEditLease(lease)}
                          onCancel={() => {
                            setLeaseActionError("");
                            setLeaseCancelTarget(lease);
                          }}
                          onDelete={() => {
                            setLeaseActionError("");
                            const tn = lease.tenant ?? data.tenants?.find((t: any) => t.id === lease.tenantId);
                            const name = tn ? `${tn.firstName ?? ""} ${tn.lastName ?? ""}`.trim() : "this lease";
                            setLeaseDeleteTarget({ id: lease.id, label: name || `lease #${lease.id}` });
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="pg-muted">No current lease linked to this property.</div>
                  )}

                  <details open={leaseHistoryOpen || undefined} onToggle={(e) => setLeaseHistoryOpen((e.target as HTMLDetailsElement).open)}>
                    <summary className="pg-muted" style={{ cursor: "pointer" }}>
                      Lease history
                    </summary>
                    <div style={{ height: 10 }} />
                    {(data.leases?.filter?.((l: any) => !currentLeaseIdSet.has(String(l.id)))?.length ?? 0) ? (
                      <div className="pg-workspace-card-stack">
                        {data.leases
                          .filter((l: any) => !currentLeaseIdSet.has(String(l.id)))
                          .map((l: any) => (
                            <PropertyLeaseCard
                              key={l.id}
                              lease={l}
                              fallbackTenants={data.tenants}
                              cardId={`lease-card-${l.id}`}
                              highlighted={highlightLeaseId === String(l.id)}
                              showEdit={!["CANCELLED", "TERMINATED", "ARCHIVED"].includes(l.status)}
                              showCancel={false}
                              showDelete={!["ACTIVE", "MONTH_TO_MONTH"].includes(l.status)}
                              canGenerateInvoice={
                                isCurrentLeaseStatus(String(l.displayStatus ?? l.status ?? "")) && Boolean(l.tenantId)
                              }
                              onGenerateInvoice={() => setGenerateLeaseTarget(l)}
                              onEdit={() => onEditLease(l)}
                              onDelete={() => {
                                setLeaseActionError("");
                                const tn = l.tenant ?? data.tenants?.find((t: any) => t.id === l.tenantId);
                                const name = tn ? `${tn.firstName ?? ""} ${tn.lastName ?? ""}`.trim() : "this lease";
                                setLeaseDeleteTarget({ id: l.id, label: name || `lease #${l.id}` });
                              }}
                            />
                          ))}
                      </div>
                    ) : (
                      <div className="pg-muted">No historical leases.</div>
                    )}
                  </details>
                </div>
              ) : null}

              {tab === "documents" ? (
                <div className="pg-workspace-inset-list">
                  <div className="pg-muted">{data.documents?.length ?? 0} documents.</div>
                  <Link className="pg-btn pg-btn-ghost" to={`/documents`}>
                    Open documents
                  </Link>
                </div>
              ) : null}

              {tab === "reports" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <Card title="Property-level reports">
                    <div className="pg-muted" style={{ marginBottom: 12 }}>
                      Uses the same canonical statement and aggregates as Overview and Financials.
                    </div>
                    {reportsLoading ? (
                      <div className="pg-muted">Loading catalog…</div>
                    ) : (reportsCatalog?.reports ?? []).length ? (
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                        {reportsCatalog.reports.map((r: any) => (
                          <li key={r.id} className="pg-workspace-inset">
                            <div style={{ fontWeight: 600 }}>{r.title}</div>
                            <div className="pg-muted" style={{ fontSize: 13, marginTop: 4 }}>
                              {r.description}
                            </div>
                            <div style={{ marginTop: 10 }}>
                              {r.href ? (
                                <Link className="pg-btn pg-btn-primary" to={r.href}>
                                  Open
                                </Link>
                              ) : (
                                <Link
                                  className="pg-btn pg-btn-primary"
                                  to={`/owned-properties/${id}?tab=${r.tab}${r.tab === "financials" ? "&fin=statement" : ""}`}
                                >
                                  Go to workspace
                                </Link>
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
      </Container>

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
    </Section>
  );
}
