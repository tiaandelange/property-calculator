import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/DashboardKit";
import { getPortfolioDashboardSummary, getProperties } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { PG_WORKSPACE_DASH } from "../nav/workspaceBreadcrumbs";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, PointElement, LineElement);

const TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "LONG_TERM_RENTAL", label: "Long-Term Rental" },
  { id: "SHORT_TERM_RENTAL", label: "Short-Term Rental / Airbnb" },
  { id: "PRIMARY_RESIDENCE", label: "Primary Residence" },
  { id: "HOUSE_HACK", label: "House Hack" },
  { id: "BRRRR", label: "BRRRR" },
  { id: "FLIP", label: "Flip / Renovation Project" },
  { id: "VACANT_LAND", label: "Vacant Land" },
  { id: "COMMERCIAL", label: "Commercial" },
  { id: "MIXED_USE", label: "Mixed Use" },
  { id: "OTHER", label: "Other" }
];

function parseTypesParam(search: string) {
  const raw = new URLSearchParams(search).get("types");
  if (!raw) return [] as string[];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseMonthParam(search: string) {
  const raw = new URLSearchParams(search).get("month");
  if (!raw) return null;
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function parsePropertyParam(search: string): string | number | null {
  const raw = new URLSearchParams(search).get("propertyId");
  if (!raw) return null;
  const t = raw.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return t;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function monthDropdownValues() {
  const out: string[] = [];
  const d = new Date();
  for (let i = -36; i <= 24; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(x.toISOString().slice(0, 7));
  }
  return [...new Set(out)].sort((a, b) => b.localeCompare(a));
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function FilterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
    </svg>
  );
}

function fmtZar(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `R ${Math.round(x).toLocaleString()}`;
}

export function OwnedPropertiesPortfolioDashboardPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => parseTypesParam(search));
  const [month, setMonth] = useState<string | null>(() => parseMonthParam(search) ?? new Date().toISOString().slice(0, 7));
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string | number | null>(() => parsePropertyParam(search));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersWrapRef = useRef<HTMLDivElement | null>(null);

  const monthChoices = useMemo(() => monthDropdownValues(), []);
  const monthSelectOptions = useMemo(() => {
    if (!month || monthChoices.includes(month)) return monthChoices;
    return [month, ...monthChoices].sort((a, b) => b.localeCompare(a));
  }, [monthChoices, month]);

  const load = async (types = selectedTypes, nextMonth = month, nextPropertyId = propertyId) => {
    setLoading(true);
    setError("");
    try {
      const res = await getPortfolioDashboardSummary({ propertyTypes: types, month: nextMonth, propertyId: nextPropertyId });
      setData(res);
    } catch (e: any) {
      console.error("[PortfolioDashboard] load failed", e);
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load portfolio dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []); // initial

  useEffect(() => {
    const next = parseTypesParam(search);
    setSelectedTypes(next);
    const nextMonth = parseMonthParam(search) ?? month;
    const nextPropertyId = parsePropertyParam(search);
    if (nextMonth) setMonth(nextMonth);
    setPropertyId(nextPropertyId);
    void load(next, nextMonth, nextPropertyId);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function loadProps() {
      try {
        const rows = await getProperties();
        if (!cancelled) setProperties(rows);
      } catch {
        if (!cancelled) setProperties([]);
      }
    }
    void loadProps();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      void load(selectedTypes, month, propertyId);
      void (async () => {
        try {
          setProperties(await getProperties());
        } catch {
          /* noop */
        }
      })();
    };
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, [selectedTypes, month, propertyId]);

  useEffect(() => {
    if (!filtersOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!filtersWrapRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const hasProperties = (data?.kpis?.totalProperties?.value ?? data?.totalProperties ?? 0) > 0;

  const noiTrend = useMemo(() => {
    const rows = data?.charts?.monthlyNOITrend ?? [];
    return {
      labels: rows.map((r: any) => r.label),
      datasets: [
        { label: "Monthly NOI", data: rows.map((r: any) => r.noi), borderColor: "#20C997", backgroundColor: "rgba(32,201,151,0.2)" }
      ]
    };
  }, [data]);

  const expenseMix = useMemo(() => {
    const rows = (data?.charts?.incomeExpenseComposition ?? []).filter((r: any) => r.type === "expense");
    const labels = rows.map((r: any) => r.category);
    const values = rows.map((r: any) => r.amount);
    const colors = labels.map((_l: any, idx: number) => ["#FFB020", "#20C997", "#4D96FF", "#FF4D4F", "#9B59B6", "#00C2A8"][idx % 6]);
    return { labels, datasets: [{ data: values, backgroundColor: colors }] };
  }, [data]);

  const incomeVsExpenseByProperty = useMemo(() => {
    const rows = data?.charts?.cashFlowByProperty ?? [];
    return {
      labels: rows.map((r: any) => r.name),
      datasets: [
        { label: "Income", data: rows.map((r: any) => r.monthlyIncome ?? 0), backgroundColor: "rgba(32,201,151,0.35)", borderColor: "#20C997" },
        { label: "Expenses", data: rows.map((r: any) => r.monthlyExpenses ?? 0), backgroundColor: "rgba(255,176,32,0.35)", borderColor: "#FFB020" }
      ]
    };
  }, [data]);

  const setTypesFromMultiSelect = (next: string[]) => {
    const params = new URLSearchParams(search);
    if (next.length) params.set("types", next.join(","));
    else params.delete("types");
    if (month) params.set("month", month);
    if (propertyId != null) params.set("propertyId", String(propertyId));
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  const filterActive = propertyId != null || selectedTypes.length > 0;

  const resetFilters = () => {
    const params = new URLSearchParams();
    params.set("month", new Date().toISOString().slice(0, 7));
    navigate(`/owned-properties/dashboard?${params.toString()}`);
    setFiltersOpen(false);
  };

  const k = data?.kpis ?? {};
  const monthlyIncomeFromLeases = Number(
    data?.contractualMonthlyRentFromLeases ?? k?.monthlyNOI?.contractualMonthlyRentFromLeases ?? 0
  );
  const monthlyExpensesAllIn = Number(
    k?.monthlyExpenses?.value ??
      (Number(data?.totalMonthlyOperatingExpenses ?? 0) + Number(data?.totalMonthlyDebtService ?? 0))
  );
  const monthlyLeaseBasisCashFlow = monthlyIncomeFromLeases - monthlyExpensesAllIn;
  const investedRaw = k?.trueCashOnCashROI?.totalCashInvested;
  const totalCashInvestedForCoc =
    investedRaw != null && Number(investedRaw) > 0 ? Number(investedRaw) : null;
  /** Annualised cash-on-cash: (monthly lease-basis cash flow × 12) ÷ cash invested */
  const cashOnCashAnnualPercent =
    totalCashInvestedForCoc != null ? ((monthlyLeaseBasisCashFlow * 12) / totalCashInvestedForCoc) * 100 : null;

  const monthlyOperatingExpenses = Number(k?.monthlyNOI?.operatingExpenses ?? data?.totalMonthlyOperatingExpenses ?? 0);
  const irrBaselineLabel = (c?: string) => {
    switch (c) {
      case "STATEMENT_LEDGER_LEASE_INCOME_FLOOR":
        return "trailing‑12 · lease rent floor";
      case "STATEMENT_LEDGER_AVG":
        return "trailing‑12 ledger";
      case "EXPECTED_MONTHLY":
        return "expected monthly (form)";
      case "MODELED_FALLBACK":
        return "modeled (lease/STR)";
      default:
        return c ?? "—";
    }
  };

  const irrVp = k?.portfolioIRR?.valuePercent;
  const portfolioIrrPct =
    irrVp != null && Number.isFinite(Number(irrVp)) ? Number(irrVp) : null;
  const irrDiag = k?.portfolioIRR?.diagnostics as
    | {
        statusCode?: string;
        statusMessage?: string;
        filteredPropertyCount?: number;
        eligiblePropertyCount?: number;
        irrSolveAttempted?: boolean;
        cf0?: number | null;
        yearlyCashFlows?: number[];
        sumUndiscountedCashFlows?: number;
        holdingHorizonYears?: number;
        propertyInputs?: Array<{
          propertyId?: number;
          propertyName?: string;
          invested?: number;
          holdingYears?: number;
          baseMonthlyIncome?: number;
          baseMonthlyExpenseTotal?: number;
          operatingBaseline?: string;
          bondExitBasis?: string;
          bondBalanceAtExit?: number;
        }>;
      }
    | undefined;
  const irrProj = k?.portfolioIRR?.projectionGrowth as
    | { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number }
    | undefined;

  const analysisOverTime = k?.portfolioAnalysisOverTime as
    | {
        projectionGrowth?: { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number };
        appreciationDefaultPercent?: number;
        bondHorizonCapYears?: number;
        analysisLimitedByBondSchedule?: boolean;
        columns?: Array<{
          year: number;
          headerLabel: string;
          totalExpectedIncomeAnnual: number;
          totalExpensesAnnual: number;
          totalAnnualCashFlow: number;
          cashOnCashRoiPercent: number | null;
          totalPropertyValue: number;
          totalEquity: number;
          totalLoanBalance: number;
          irrPercent: number | null;
        }>;
        explanation?: string;
      }
    | undefined;

  const leasesExpiringSoon = Number(data?.leases?.expiringSoon ?? 0);
  const leasesMonthToMonth = Number(data?.leases?.monthToMonth ?? 0);
  const rentDueSoon = Number(data?.rentDue?.dueSoon ?? 0);
  const rentOverdue = Number(data?.rentDue?.overdue ?? 0);
  const currentValue = Number(data?.totalCurrentEstimatedValue ?? 0);
  const bondBalance = Number(data?.totalOutstandingBondBalance ?? 0);
  const missingDocs = Number(data?.missingData?.missingLeaseDocuments ?? 0);
  const missingExpenses = Number(data?.missingData?.missingExpenseData ?? 0);
  const missingValues = Number(data?.missingData?.missingCurrentEstimatedValue ?? 0);
  const missingBonds = Number(data?.missingData?.missingOutstandingBondBalance ?? 0);
  const negativeCashFlowProps = (data?.charts?.cashFlowByProperty ?? []).filter((r: any) => Number(r.netCashFlow ?? 0) < 0).length;

  const setParam = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    });
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  return (
    <Section>
      <Helmet><title>Portfolio Dashboard | The Property Guy</title></Helmet>
      <Container>
        <PageBreadcrumb items={[PG_WORKSPACE_DASH, { label: "Portfolio overview" }]} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Portfolio Dashboard</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>
              Monitor performance, risks and next actions across your portfolio.
            </div>
          </div>
          <div
            ref={filtersWrapRef}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
              position: "relative",
              flex: "1 1 auto",
              minWidth: 0,
              marginLeft: "auto"
            }}
          >
            <Button onClick={() => load()} loading={loading}>Refresh</Button>
            <Link className="pg-btn pg-btn-secondary" to="/owned-properties/new">Add Property</Link>
            <Link className="pg-btn pg-btn-ghost" to="/financials">Add income/expense</Link>
            <Link className="pg-btn pg-btn-ghost" to="/dashboard">My reports</Link>
            <button
              type="button"
              className={`pg-btn pg-btn-ghost pg-dashboard-filter-trigger${filterActive ? " pg-dashboard-filter-trigger-active" : ""}`}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              aria-controls="portfolio-dashboard-filters"
              aria-label={filterActive ? "Open filters (filters active)" : "Open filters"}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <FilterIcon />
            </button>
            {filtersOpen ? (
              <div
                id="portfolio-dashboard-filters"
                role="dialog"
                aria-label="Dashboard filters"
                className="pg-card pg-dashboard-filters-popover"
              >
                <div className="pg-card-pad">
                  <div className="pg-card-title">Filters</div>
                  <p className="pg-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
                    Figures reflect the selected month. Hold Ctrl or ⌘ while clicking to choose multiple property types.
                  </p>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <div className="pg-muted" style={{ marginBottom: 6, fontSize: 13 }}>Property</div>
                      <select
                        className="pg-input"
                        value={propertyId ?? ""}
                        onChange={(e) => setParam({ propertyId: e.target.value || null })}
                      >
                        <option value="">All properties</option>
                        {properties.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="pg-muted" style={{ marginBottom: 6, fontSize: 13 }}>Property type</div>
                      <select
                        multiple
                        className="pg-input"
                        style={{ minHeight: 120, paddingTop: 8, paddingBottom: 8 }}
                        value={selectedTypes}
                        onChange={(e) => setTypesFromMultiSelect(Array.from(e.target.selectedOptions, (o) => o.value))}
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="pg-muted" style={{ marginBottom: 6, fontSize: 13 }}>Month</div>
                      <select
                        className="pg-input"
                        value={month ?? ""}
                        onChange={(e) => setParam({ month: e.target.value || null })}
                      >
                        {monthSelectOptions.map((ym) => (
                          <option key={ym} value={ym}>
                            {formatMonthLabel(ym)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="pg-muted" style={{ marginBottom: 6, fontSize: 13 }}>Status</div>
                      <select className="pg-input" value="ALL" onChange={() => {}} disabled>
                        <option value="ALL">All</option>
                      </select>
                      <div className="pg-muted" style={{ marginTop: 6, fontSize: 12 }}>More status filters coming soon.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
                      <Button type="button" variant="secondary" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!error ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              textAlign: "center",
              marginTop: 18,
              marginBottom: 0,
              paddingLeft: 12,
              paddingRight: 12
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "clamp(1rem, 2.2vw, 1.25rem)",
                fontWeight: 500,
                lineHeight: 1.35,
                letterSpacing: "0.03em",
                color: "var(--text2)"
              }}
            >
              Portfolio Equity / Net Worth:
            </p>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: "clamp(1.85rem, 5.5vw, 3rem)",
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: "0.02em",
                color: "var(--text2)"
              }}
            >
              {loading && data == null
                ? "…"
                : `R ${Number(data?.portfolioEquity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
          </div>
        ) : null}

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ height: 12 }} />

        {!hasProperties && !loading ? (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              title="Add your first property"
              body="Track equity, cash flow, tenants, leases and reports across your portfolio."
              actions={
                <>
                  <Link className="pg-btn pg-btn-primary" to="/owned-properties/new">Add Property</Link>
                  <Link className="pg-btn pg-btn-ghost" to="/calculators/cash-on-cash-return">Open Calculators</Link>
                </>
              }
            />
          </div>
        ) : null}

        {hasProperties ? (
          <>
            <div style={{ height: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly income</div>
                <div className="pg-stat-value" style={{ color: "#20C997" }}>R {monthlyIncomeFromLeases.toLocaleString()}</div>
                <div className="pg-stat-hint">Total contractual rent from active leases.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly expenses</div>
                <div className="pg-stat-value">R {monthlyExpensesAllIn.toLocaleString()}</div>
                <div className="pg-stat-hint">Operating costs plus bond payments.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly cash flow</div>
                <div className="pg-stat-value" style={{ color: monthlyLeaseBasisCashFlow >= 0 ? "#20C997" : "#FF4D4F" }}>
                  R {monthlyLeaseBasisCashFlow.toLocaleString()}
                </div>
                <div className="pg-stat-hint">Lease income minus total expenses.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Cash on cash ROI</div>
                <div
                  className="pg-stat-value"
                  style={{
                    color:
                      cashOnCashAnnualPercent == null
                        ? undefined
                        : cashOnCashAnnualPercent >= 0
                          ? "#20C997"
                          : "#FF4D4F"
                  }}
                >
                  {cashOnCashAnnualPercent == null ? "—" : `${cashOnCashAnnualPercent.toFixed(1)}%`}
                </div>
                <div className="pg-stat-hint">Annualised: monthly cash flow × 12 ÷ cash invested.</div>
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Portfolio IRR</div>
                <div
                  className="pg-stat-value"
                  style={{
                    color:
                      portfolioIrrPct == null ? undefined : portfolioIrrPct >= 0 ? "#20C997" : "#FF4D4F"
                  }}
                >
                  {portfolioIrrPct == null ? "Insufficient data" : `${portfolioIrrPct.toFixed(2)}%`}
                </div>
                {irrDiag ? (
                  <details style={{ marginTop: 12 }}>
                    <summary className="pg-muted" style={{ cursor: "pointer", fontSize: 12 }}>
                      Show IRR calculation detail{irrDiag.statusCode ? ` (${irrDiag.statusCode})` : ""}
                    </summary>
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 12,
                        lineHeight: 1.5
                      }}
                    >
                      <p style={{ margin: "0 0 8px" }}>{irrDiag.statusMessage ?? "No message."}</p>
                      <div className="pg-muted" style={{ marginBottom: 6 }}>
                        Properties in filter: {irrDiag.filteredPropertyCount ?? "—"} · Eligible for IRR:{" "}
                        {irrDiag.eligiblePropertyCount ?? "—"} · Solver run:{" "}
                        {irrDiag.irrSolveAttempted ? "yes" : "no"}
                      </div>
                      {irrProj ? (
                        <div className="pg-muted" style={{ marginBottom: 6 }}>
                          Admin growth assumptions: rental +{irrProj.rentalIncomeGrowthPercentAnnual ?? "—"}% / yr, expenses +
                          {irrProj.totalExpensesGrowthPercentAnnual ?? "—"}% / yr
                        </div>
                      ) : null}
                      <div style={{ marginBottom: 4 }}>
                        <strong>CF₀</strong> (upfront, should be negative): {fmtZar(irrDiag.cf0 ?? null)}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Sum of all CF</strong> (undiscounted): {fmtZar(irrDiag.sumUndiscountedCashFlows ?? null)} · Horizon:{" "}
                        {irrDiag.holdingHorizonYears ?? "—"} yrs
                      </div>
                      <div style={{ marginBottom: 6, fontWeight: 600 }}>Yearly portfolio totals (after growth; exit included in final year)</div>
                      <ul style={{ margin: "0 0 10px", paddingLeft: 18, maxHeight: 160, overflow: "auto" }}>
                        {(irrDiag.yearlyCashFlows ?? []).map((cf, i) => (
                          <li key={i}>
                            Year {i + 1}: {fmtZar(cf)}
                          </li>
                        ))}
                      </ul>
                      {irrDiag.propertyInputs && irrDiag.propertyInputs.length > 0 ? (
                        <>
                          <div style={{ marginBottom: 4, fontWeight: 600 }}>Per-property inputs (baseline & exit bond)</div>
                          <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 200, overflow: "auto" }}>
                            {irrDiag.propertyInputs.map((row) => (
                              <li key={row.propertyId}>
                                {row.propertyName ?? row.propertyId}: invest {fmtZar(row.invested)}, hold {row.holdingYears ?? "—"} yr, baseline{" "}
                                {irrBaselineLabel(row.operatingBaseline)}, income/mo {fmtZar(row.baseMonthlyIncome)}, expense/mo {fmtZar(row.baseMonthlyExpenseTotal)}, bond @ exit{" "}
                                {fmtZar(row.bondBalanceAtExit)} ({row.bondExitBasis ?? "—"})
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Total Cash Invested</div>
                <div className="pg-stat-value">R {Number(k?.trueCashOnCashROI?.totalCashInvested ?? 0).toLocaleString()}</div>
                <div className="pg-stat-hint">Sum of cash invested across properties in this filter.</div>
              </div>

              {(() => {
                const incomeMo = Number(k?.monthlyNOI?.operatingIncomeProjectedFromLeases ?? 0);
                const opExMo = Number(k?.monthlyExpenses?.operatingExpenses ?? 0);
                const debtMo = Number(k?.monthlyExpenses?.debtService ?? 0);
                const netMo = incomeMo - opExMo - debtMo;
                const currentVal = Number(data?.totalCurrentEstimatedValue ?? 0);
                const appPctRaw =
                  analysisOverTime?.appreciationDefaultPercent ?? (analysisOverTime?.projectionGrowth as any)?.appreciationDefaultPercent ?? null;
                const appPct = appPctRaw != null && Number.isFinite(Number(appPctRaw)) ? Number(appPctRaw) : null;

                const isExcellent = netMo >= 0;
                const annualShortfall = netMo < 0 ? Math.abs(netMo) * 12 : 0;
                const annualCapitalGrowth = appPct != null ? currentVal * (appPct / 100) : 0;
                const isGood = !isExcellent && annualCapitalGrowth >= annualShortfall && annualShortfall > 0;
                const label = isExcellent ? "Excellent" : isGood ? "Good" : "Poor";
                const color = isExcellent ? "#20C997" : isGood ? "#FFB020" : "#FF4D4F";
                const hint = isExcellent
                  ? "Cash flow positive."
                  : isGood
                    ? "Cash flow negative, but capital growth covers the annual shortfall."
                    : "Cash flow negative and not covered by capital growth.";

                return (
                  <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="pg-stat-title">Property Investment Index</div>
                    <div className="pg-stat-value" style={{ color }}>
                      {label}
                      {!isExcellent && !isGood ? " - Red" : ""}
                    </div>
                    <div className="pg-stat-hint">{hint}</div>
                  </div>
                );
              })()}

              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Term Left</div>
                <div className="pg-stat-value">
                  {analysisOverTime?.bondHorizonCapYears != null ? `${Number(analysisOverTime.bondHorizonCapYears).toLocaleString()} yrs` : "—"}
                </div>
                <div className="pg-stat-hint">Longest remaining bond horizon in the current filter.</div>
              </div>
            </div>

            <div style={{ height: 12 }} />
            <Card title="Analysis over time">
              <p className="pg-muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
                Projected annually from the same operating baselines as portfolio IRR (expected monthly when set; otherwise trailing‑12 averages). Income and expenses grow at{" "}
                <strong>
                  +{(analysisOverTime?.projectionGrowth?.rentalIncomeGrowthPercentAnnual ?? irrProj?.rentalIncomeGrowthPercentAnnual ?? "—")}%
                </strong>{" "}
                and{" "}
                <strong>
                  +{(analysisOverTime?.projectionGrowth?.totalExpensesGrowthPercentAnnual ?? irrProj?.totalExpensesGrowthPercentAnnual ?? "—")}%
                </strong>{" "}
                per year (admin defaults). Values appreciate per property (blank →{" "}
                {analysisOverTime?.appreciationDefaultPercent ?? "—"}% p.a.). Loans amortise when rate and payment resolve. Cash‑on‑cash uses total cash invested on the dashboard.                 Column headings use ownership years from the earliest{" "}
                <strong>purchase date</strong> in your filter when those dates are saved on the property; if none are set, headings stay projection years 1–30 instead.{" "}
                {analysisOverTime?.analysisLimitedByBondSchedule ? (
                  <>
                    Horizons stop at <strong>{analysisOverTime.bondHorizonCapYears ?? "—"} years</strong> forward — the longest bond payoff schedule in this filter (original term + start date, or manual months remaining).
                  </>
                ) : (
                  <>With no resolved bond schedules in the filter, milestones run through 30 years.</>
                )}{" "}
                <strong>Portfolio IRR</strong> in the table is solved for the same IRR-eligible properties as the headline card, assuming sale at the <em>end</em> of that column’s horizon (operating flows through that year plus net sale proceeds).
              </p>
              {analysisOverTime?.columns?.length ? (
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 720,
                      borderCollapse: "collapse",
                      fontSize: 13
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          style={{
                            textAlign: "left",
                            padding: "10px 8px",
                            borderBottom: "1px solid rgba(255,255,255,0.12)",
                            whiteSpace: "nowrap"
                          }}
                        >
                          Metric
                        </th>
                        {analysisOverTime.columns.map((col) => (
                          <th
                            key={col.year}
                            scope="col"
                            style={{
                              textAlign: "right",
                              padding: "10px 8px",
                              borderBottom: "1px solid rgba(255,255,255,0.12)",
                              whiteSpace: "nowrap",
                              fontWeight: 600
                            }}
                          >
                            {col.headerLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          {
                            label: "Total expected income",
                            pick: (c: (typeof analysisOverTime.columns)[0]) => fmtZar(c.totalExpectedIncomeAnnual)
                          },
                          {
                            label: "Total expenses",
                            pick: (c: (typeof analysisOverTime.columns)[0]) => fmtZar(c.totalExpensesAnnual)
                          },
                          {
                            label: "Total annual cash flow",
                            pick: (c: (typeof analysisOverTime.columns)[0]) => fmtZar(c.totalAnnualCashFlow)
                          },
                          {
                            label: "Cash-on-cash ROI",
                            pick: (c: (typeof analysisOverTime.columns)[0]) =>
                              c.cashOnCashRoiPercent == null || !Number.isFinite(c.cashOnCashRoiPercent)
                                ? "—"
                                : `${c.cashOnCashRoiPercent.toFixed(1)}%`
                          },
                          {
                            label: "Property value",
                            pick: (c: (typeof analysisOverTime.columns)[0]) => fmtZar(c.totalPropertyValue)
                          },
                          {
                            label: "Equity",
                            pick: (c: (typeof analysisOverTime.columns)[0]) => fmtZar(c.totalEquity)
                          },
                          {
                            label: "Loan balance",
                            pick: (c: (typeof analysisOverTime.columns)[0]) => fmtZar(c.totalLoanBalance)
                          },
                          {
                            label: "Portfolio IRR",
                            pick: (c: (typeof analysisOverTime.columns)[0]) =>
                              c.irrPercent == null || !Number.isFinite(c.irrPercent) ? "—" : `${c.irrPercent.toFixed(2)}%`
                          }
                        ] as const
                      ).map((row) => (
                        <tr key={row.label}>
                          <th
                            scope="row"
                            style={{
                              textAlign: "left",
                              padding: "8px",
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                              fontWeight: 500,
                              whiteSpace: "nowrap"
                            }}
                          >
                            {row.label}
                          </th>
                          {analysisOverTime.columns!.map((col) => (
                            <td
                              key={`${row.label}-${col.year}`}
                              style={{
                                textAlign: "right",
                                padding: "8px",
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                fontVariantNumeric: "tabular-nums"
                              }}
                            >
                              {row.pick(col)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="pg-muted">No projection columns returned.</div>
              )}
            </Card>

            <div style={{ height: 12 }} />
            <Card title="Alerts & next actions">
              <div style={{ display: "grid", gap: 8 }}>
                {rentOverdue > 0 ? <Link className="pg-link" to="/invoices">Overdue rent ({rentOverdue}) — review invoices</Link> : null}
                {rentDueSoon > 0 ? <Link className="pg-link" to="/invoices">Rent due soon ({rentDueSoon}) — follow up early</Link> : null}
                {leasesExpiringSoon > 0 ? <Link className="pg-link" to="/leases">Leases expiring soon ({leasesExpiringSoon}) — plan renewals</Link> : null}
                {leasesMonthToMonth > 0 ? <Link className="pg-link" to="/leases">Month-to-month leases ({leasesMonthToMonth}) — confirm terms</Link> : null}
                {missingDocs > 0 ? <Link className="pg-link" to="/documents">Missing documents ({missingDocs}) — upload agreements</Link> : null}
                {missingExpenses > 0 ? <Link className="pg-link" to="/financials">No expense data ({missingExpenses}) — capture operating costs</Link> : null}
                {negativeCashFlowProps > 0 ? <Link className="pg-link" to="/owned-properties/my-properties?sort=LOWEST_CASH">Negative cash flow ({negativeCashFlowProps}) — review costs</Link> : null}
                {missingValues + missingBonds > 0 ? (
                  <Link className="pg-link" to="/owned-properties/metrics/equity">
                    Missing value/bond figures ({missingValues + missingBonds}) — update equity inputs
                  </Link>
                ) : null}
                {!rentOverdue && !rentDueSoon && !leasesExpiringSoon && !leasesMonthToMonth && !missingDocs && !missingExpenses && !negativeCashFlowProps && !(missingValues + missingBonds) ? (
                  <div className="pg-muted">No urgent alerts based on your current filters.</div>
                ) : null}
              </div>
            </Card>

            <div style={{ height: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12, alignItems: "stretch" }}>
              <Card title="Monthly NOI trend">
                <Line data={noiTrend} />
              </Card>
              <Card title="Expense mix (month)">
                {(data?.charts?.incomeExpenseComposition?.length ?? 0) ? <Doughnut data={expenseMix} /> : <div className="pg-muted">No expense data captured yet.</div>}
              </Card>
            </div>

            <div style={{ height: 12 }} />
            <Card title="Income vs expenses by property (month)">
              {(data?.charts?.cashFlowByProperty?.length ?? 0) ? <Bar data={incomeVsExpenseByProperty} /> : <div className="pg-muted">No property-level financials available yet.</div>}
            </Card>
          </>
        ) : null}
      </Container>
    </Section>
  );
}

