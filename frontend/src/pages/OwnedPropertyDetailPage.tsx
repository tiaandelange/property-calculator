import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { ModalOverlay, ModalPanel } from "../components/ui/Modal";
import {
  cancelLease,
  createPropertyIncome,
  deleteLease,
  getProperty,
  getPropertyTenants,
  getPropertyStatement,
  getPropertyWorkspaceReports,
  getTenants,
  getPortfolioDashboardSummary,
  getTenantsEligibleForProperty,
  linkTenantToProperty,
  updateLease,
  unlinkTenantFromProperty
} from "../api/ownedProperties";
import { WorkspaceTabs } from "../components/workspace/WorkspaceTabs";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
import { WorkspaceFinancialsTab } from "../features/properties/workspace/WorkspaceFinancialsTab";
import { WorkspaceOverviewTab } from "../features/properties/workspace/WorkspaceOverviewTab";

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
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [eligibleTenants, setEligibleTenants] = useState<any[]>([]);
  const [perf, setPerf] = useState<any>(null);
  const [linkTenantId, setLinkTenantId] = useState<string | "">("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [unlinkTenantPending, setUnlinkTenantPending] = useState<any>(null);
  const [stmt, setStmt] = useState<any>(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [reportsCatalog, setReportsCatalog] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const tabRaw = useMemo(() => new URLSearchParams(search).get("tab") ?? "overview", [search]);
  const tab = tabRaw === "lease" ? "leases" : tabRaw === "performance" ? "reports" : tabRaw;
  const finSub = useMemo(() => new URLSearchParams(search).get("fin") ?? "statement", [search]);
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
      const [prop, tenants, dash, ledgerOutcome, propTenants, eligible] = await Promise.all([
        getProperty(id, { bustCache: true, month: summaryMonth }),
        getTenants(),
        dashPromise,
        ledgerOutcomePromise,
        getPropertyTenants(id),
        getTenantsEligibleForProperty(id)
      ]);
      if (seq !== loadSeqRef.current) return;
      setData({ ...prop, tenants: propTenants });
      setAllTenants(tenants);
      setEligibleTenants(eligible);
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

  const refreshAfterMutation = async () => {
    await loadAll();
    if (id) invalidatePropertyWorkspace(id);
  };

  const onCancelLease = async (lease: { id: string | number }) => {
    const cancellationDate = window.prompt("Cancellation date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!cancellationDate) return;
    const cancellationReason = window.prompt("Cancellation reason (optional)", "") ?? undefined;
    await cancelLease(lease.id, { cancellationDate, cancellationReason, cancelledBy: "LANDLORD" });
    await refreshAfterMutation();
  };

  const onUnlinkTenant = async (tenantId: string | number) => {
    if (!id) return;
    if (!window.confirm("Unlink this tenant from the property? (Active leases may block this.)")) return;
    try {
      await unlinkTenantFromProperty(id, tenantId);
      await refreshAfterMutation();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to unlink tenant.");
    }
  };

  const onLinkExistingTenant = async () => {
    if (!id || !linkTenantId) return;
    await linkTenantToProperty(id, linkTenantId);
    setLinkTenantId("");
    setLinkModalOpen(false);
    await refreshAfterMutation();
  };

  const onArchiveLease = async (leaseId: string | number) => {
    if (!window.confirm("Archive this lease? (Historical record is kept.)")) return;
    await deleteLease(leaseId);
    await refreshAfterMutation();
  };

  const onEditLease = async (lease: any) => {
    if (!lease?.id) return;
    const leaseType = window.prompt("Lease type (FIXED_TERM or MONTH_TO_MONTH)", lease.leaseType ?? "FIXED_TERM");
    if (!leaseType) return;
    const startDate = window.prompt("Start date (YYYY-MM-DD)", lease.startDate ? String(lease.startDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    if (!startDate) return;
    const fixedTermEndDate =
      leaseType === "FIXED_TERM"
        ? window.prompt(
            "Fixed term end date (YYYY-MM-DD)",
            lease.fixedTermEndDate ? String(lease.fixedTermEndDate).slice(0, 10) : ""
          )
        : "";

    const monthlyRent = window.prompt("Monthly rent (number)", String(lease.monthlyRent ?? 0));
    if (monthlyRent == null) return;
    const depositAmount = window.prompt("Deposit amount (number)", String(lease.depositAmount ?? 0));
    if (depositAmount == null) return;
    const rentDueDay = window.prompt("Rent due day (1-31)", String(lease.rentDueDay ?? 1));
    if (rentDueDay == null) return;
    const notes = window.prompt("Notes (optional)", lease.notes ?? "") ?? undefined;

    try {
      await updateLease(lease.id, {
        leaseType,
        startDate,
        fixedTermEndDate: leaseType === "FIXED_TERM" ? fixedTermEndDate || null : null,
        monthlyRent: Number(monthlyRent),
        depositAmount: Number(depositAmount),
        rentDueDay: Number(rentDueDay),
        notes
      });
      await refreshAfterMutation();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to update lease.");
    }
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

  const linkedTenantIds = useMemo(() => new Set((data?.tenants ?? []).map((t: any) => String(t.id))), [data]);
  const filteredEligibleTenants = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    const rows = eligibleTenants.filter((t: any) => !linkedTenantIds.has(String(t.id)));
    if (!q) return rows;
    return rows.filter((t: any) => {
      const name = `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim().toLowerCase();
      const email = String(t.email ?? "").toLowerCase();
      const phone = String(t.phone ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [eligibleTenants, linkSearch, linkedTenantIds]);

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
                  { key: "tenants", label: "Link Tenants" },
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

              {tab === "tenants" ? (
                <div className="pg-workspace-inset-list">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="pg-btn pg-btn-primary" type="button" onClick={() => setLinkModalOpen(true)}>
                      <Plus size={18} style={{ marginRight: 8 }} aria-hidden />
                      Link New Tenant
                    </button>
                    <Link className="pg-btn pg-btn-ghost" to="/tenants">
                      Open Tenant Directory
                    </Link>
                  </div>

                  {(data.tenants?.length ?? 0) ? (
                    <Card title="Linked tenants">
                      <div className="pg-tenants-table-wrap">
                        <table className="pg-tenants-table">
                          <thead>
                            <tr>
                              <th scope="col">Tenant</th>
                              <th scope="col">Contact</th>
                              <th scope="col">Lease Status</th>
                              <th scope="col">
                                <span className="pg-tenants-sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.tenants.map((t: any) => (
                              <tr key={t.id}>
                                <td>
                                  <div className="pg-tenants-cell-tenant">
                                    <span className="pg-tenants-avatar" aria-hidden>
                                      {String(t.firstName ?? "T").slice(0, 1).toUpperCase()}
                                      {String(t.lastName ?? "").slice(0, 1).toUpperCase()}
                                    </span>
                                    <div className="pg-tenants-cell-tenant-text">
                                      <Link className="pg-tenants-name" to={`/tenants/${t.id}`}>
                                        {(t.firstName ?? "").trim()} {(t.lastName ?? "").trim()}
                                      </Link>
                                      <div className="pg-tenants-sub">{t.email?.trim() || "No email"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="pg-tenants-contact">{t.phone?.trim() || "No phone"}</div>
                                </td>
                                <td>
                                  <span className="pg-tenants-sub">{t.currentLease?.displayStatus ?? t.currentLease?.status ?? "No active lease"}</span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    <Link className="pg-btn pg-btn-ghost" to={`/tenants/${t.id}/edit`}>
                                      Edit
                                    </Link>
                                    <button
                                      className="pg-btn pg-btn-ghost"
                                      type="button"
                                      disabled={tenantIdsWithCurrentLease.has(String(t.id))}
                                      title={
                                        tenantIdsWithCurrentLease.has(String(t.id))
                                          ? "Cancel the current lease before de-linking this tenant."
                                          : undefined
                                      }
                                      onClick={() => setUnlinkTenantPending(t)}
                                    >
                                      <Trash2 size={16} style={{ marginRight: 6 }} aria-hidden />
                                      De-link
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ) : (
                    <div className="pg-muted">No tenant linked to this property yet.</div>
                  )}
                </div>
              ) : null}

              {tab === "leases" ? (
                <div className="pg-workspace-inset-list">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Link className="pg-btn pg-btn-primary" to="/leases">
                      {currentLeases.length === 0 ? "Create lease" : "Add another lease"}
                    </Link>
                    {currentLeases.length > 0 ? (
                      <span className="pg-muted">
                        Combined contractual rent: <strong>R {combinedContractRent.toLocaleString()}</strong>/mo ({currentLeases.length} active)
                      </span>
                    ) : null}
                  </div>
                  {currentLeases.length > 0 ? (
                    <div className="pg-workspace-inset-list">
                      {currentLeases.map((lease: any) => {
                        const tn = lease.tenant ?? data.tenants?.find((t: any) => t.id === lease.tenantId);
                        return (
                          <Card key={lease.id} title={`Current lease #${lease.id}`}>
                            <div className="pg-muted" style={{ marginBottom: 6 }}>
                              Tenant:{" "}
                              {tn?.id ? (
                                <Link className="pg-link" to={`/tenants/${tn.id}`}>
                                  {tn.firstName} {tn.lastName}
                                </Link>
                              ) : (
                                <span className="pg-muted">Unknown</span>
                              )}
                            </div>
                            <div>
                              <strong>{lease.leaseType}</strong> <span className="pg-muted">({lease.displayStatus ?? lease.status})</span>
                            </div>
                            <div className="pg-muted" style={{ marginTop: 4 }}>
                              Start: {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : "-"}{" "}
                              | End:{" "}
                              {lease.fixedTermEndDate ? new Date(lease.fixedTermEndDate).toLocaleDateString() : <span className="pg-muted">Month-to-month</span>}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              Rent: R {Number(lease.monthlyRent ?? 0).toLocaleString()} | Deposit: R {Number(lease.depositAmount ?? 0).toLocaleString()}
                            </div>
                            <div style={{ marginTop: 4 }}>Rent due day: {lease.rentDueDay}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onEditLease(lease)}>
                                Edit lease
                              </button>
                              <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void onCancelLease(lease)}>
                                Cancel lease
                              </button>
                              <Link className="pg-btn pg-btn-primary" to={`/owned-properties/${id}?tab=financials&fin=invoice`}>
                                Create invoice from lease
                              </Link>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pg-muted">No current lease linked to this property.</div>
                  )}

                  <details>
                    <summary className="pg-muted" style={{ cursor: "pointer" }}>
                      Lease history
                    </summary>
                    <div style={{ height: 10 }} />
                    {(data.leases?.filter?.((l: any) => !currentLeaseIdSet.has(String(l.id)))?.length ?? 0) ? (
                      <div className="pg-workspace-inset-list">
                        {data.leases
                          .filter((l: any) => !currentLeaseIdSet.has(String(l.id)))
                          .map((l: any) => (
                            <div key={l.id} className="pg-workspace-inset">
                              <div className="pg-muted" style={{ marginBottom: 6 }}>
                                Tenant:{" "}
                                {l.tenant?.id ? (
                                  <Link className="pg-link" to={`/tenants/${l.tenant.id}`}>
                                    {l.tenant.firstName} {l.tenant.lastName}
                                  </Link>
                                ) : (
                                  <span className="pg-muted">Unknown</span>
                                )}
                              </div>
                              <div>
                                <strong>{l.leaseType}</strong> <span className="pg-muted">({l.status})</span>
                              </div>
                              <div className="pg-muted" style={{ marginTop: 4 }}>
                                Start: {l.startDate ? new Date(l.startDate).toLocaleDateString() : "-"}{" "}
                                | End: {l.fixedTermEndDate ? new Date(l.fixedTermEndDate).toLocaleDateString() : "Month-to-month"}
                              </div>
                              <div style={{ marginTop: 4 }}>
                                Rent: R {Number(l.monthlyRent ?? 0).toLocaleString()} | Deposit: R {Number(l.depositAmount ?? 0).toLocaleString()}
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                                {!["CANCELLED", "TERMINATED", "ARCHIVED"].includes(l.status) ? (
                                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onEditLease(l)}>
                                    Edit
                                  </button>
                                ) : null}
                                {["ACTIVE", "MONTH_TO_MONTH"].includes(l.status) ? null : (
                                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onArchiveLease(l.id)}>
                                    Archive lease
                                  </button>
                                )}
                              </div>
                            </div>
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
      {linkModalOpen ? (
        <>
          <ModalOverlay open onClose={() => setLinkModalOpen(false)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Link tenant"
              onClose={() => setLinkModalOpen(false)}
              actions={
                <button className="pg-btn pg-btn-primary" type="button" onClick={() => void onLinkExistingTenant()} disabled={!linkTenantId}>
                  Link
                </button>
              }
            >
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <div className="pg-muted">
                  Select an existing tenant to link to this property. New tenant profiles are created in the Tenants page.
                </div>
                <Input placeholder="Search tenant…" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} />
                <div style={{ maxHeight: "52vh", overflow: "auto" }} className="pg-workspace-inset-list">
                  {filteredEligibleTenants.length ? (
                    filteredEligibleTenants.map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        className="pg-workspace-inset"
                        onClick={() => setLinkTenantId(String(t.id))}
                        aria-pressed={String(linkTenantId) === String(t.id)}
                        style={{
                          textAlign: "left",
                          width: "100%",
                          cursor: "pointer",
                          outline: "none",
                          border: String(linkTenantId) === String(t.id) ? "1px solid var(--primary-border)" : undefined
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              {(t.firstName ?? "").trim()} {(t.lastName ?? "").trim()}
                            </div>
                            <div className="pg-muted" style={{ fontSize: 13 }}>
                              {t.email?.trim() || "No email"} {t.phone?.trim() ? `· ${t.phone.trim()}` : ""}
                            </div>
                          </div>
                          {String(linkTenantId) === String(t.id) ? <span className="pg-muted">Selected</span> : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="pg-muted">No eligible tenants found.</div>
                  )}
                </div>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}

      {unlinkTenantPending ? (
        <>
          <ModalOverlay open onClose={() => setUnlinkTenantPending(null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel title="De-link tenant" onClose={() => setUnlinkTenantPending(null)}>
              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div>
                  Remove{" "}
                  <strong>
                    {unlinkTenantPending.firstName} {unlinkTenantPending.lastName}
                  </strong>{" "}
                  from this property?
                </div>
                <div className="pg-muted" style={{ fontSize: 13 }}>
                  This only de-links the tenant from this property. Tenant profiles remain available in the Tenants directory.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setUnlinkTenantPending(null)}>
                    Cancel
                  </button>
                  <button
                    className="pg-btn pg-btn-danger"
                    type="button"
                    disabled={tenantIdsWithCurrentLease.has(String(unlinkTenantPending.id))}
                    title={
                      tenantIdsWithCurrentLease.has(String(unlinkTenantPending.id))
                        ? "Cancel the current lease before de-linking this tenant."
                        : undefined
                    }
                    onClick={() => {
                      const tid = unlinkTenantPending.id;
                      setUnlinkTenantPending(null);
                      void onUnlinkTenant(tid);
                    }}
                  >
                    De-link tenant
                  </button>
                </div>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}
    </Section>
  );
}
