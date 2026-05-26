import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { Briefcase, DollarSign, Home, Percent, Users } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/DashboardKit";
import { getPortfolioDashboardSummary, getProperties, getTenants } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { PG_WORKSPACE_DASH } from "../nav/workspaceBreadcrumbs";
import { useAuth } from "../contexts/AuthContext";
import { PortfolioMetricCard } from "../features/portfolio-dashboard/PortfolioMetricCard";
import { PortfolioOverviewChart } from "../features/portfolio-dashboard/PortfolioOverviewChart";
import { RecentActivityPanel } from "../features/portfolio-dashboard/RecentActivityPanel";
import {
  RecentPropertiesSection,
  type RecentPropertyCard
} from "../features/portfolio-dashboard/RecentPropertiesSection";
import {
  changeFromSeries,
  displayUserName,
  fmtZar,
  formatChangeLine,
  type MonthIncomeExpenseRow,
  type NoiTrendRow,
  type PortfolioChartRange
} from "../features/portfolio-dashboard/portfolioDashboardUtils";

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

export function OwnedPropertiesPortfolioDashboardPage() {
  const { search } = useLocation();
  const { session, profile } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [properties, setProperties] = useState<Record<string, unknown>[]>([]);
  const [tenantCount, setTenantCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState<PortfolioChartRange>("THIS_YEAR");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => parseTypesParam(search));
  const [month, setMonth] = useState<string | null>(() => parseMonthParam(search) ?? new Date().toISOString().slice(0, 7));
  const [propertyId, setPropertyId] = useState<string | number | null>(() => parsePropertyParam(search));

  const load = async (types = selectedTypes, nextMonth = month, nextPropertyId = propertyId) => {
    setLoading(true);
    setError("");
    try {
      const res = await getPortfolioDashboardSummary({ propertyTypes: types, month: nextMonth, propertyId: nextPropertyId });
      setData(res as Record<string, unknown>);
    } catch (e: unknown) {
      console.error("[PortfolioDashboard] load failed", e);
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to load portfolio dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    setPropertiesLoading(true);
    try {
      const [props, tenants] = await Promise.all([getProperties(), getTenants().catch(() => [])]);
      setProperties(props as Record<string, unknown>[]);
      setTenantCount(Array.isArray(tenants) ? tenants.length : 0);
    } catch (e) {
      console.warn("[PortfolioDashboard] properties list failed", e);
      setProperties([]);
      setTenantCount(0);
    } finally {
      setPropertiesLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadProperties();
  }, []);

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
    const handler = () => {
      void load(selectedTypes, month, propertyId);
      void loadProperties();
    };
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, [selectedTypes, month, propertyId]);

  const k = (data?.kpis ?? {}) as Record<string, unknown>;
  const hasProperties = Number((k.totalProperties as { value?: number })?.value ?? data?.totalProperties ?? 0) > 0;

  const monthlyIncomeFromLeases = Number(
    data?.contractualMonthlyRentFromLeases ??
      (k.monthlyNOI as { contractualMonthlyRentFromLeases?: number })?.contractualMonthlyRentFromLeases ??
      0
  );
  const monthlyExpensesAllIn = Number(
    (k.monthlyExpenses as { value?: number })?.value ??
      Number(data?.totalMonthlyOperatingExpenses ?? 0) + Number(data?.totalMonthlyDebtService ?? 0)
  );
  const monthlyLeaseBasisCashFlow = monthlyIncomeFromLeases - monthlyExpensesAllIn;
  const investedRaw = (k.trueCashOnCashROI as { totalCashInvested?: number })?.totalCashInvested;
  const totalCashInvestedForCoc =
    investedRaw != null && Number(investedRaw) > 0 ? Number(investedRaw) : null;
  const cashOnCashAnnualPercent =
    totalCashInvestedForCoc != null ? ((monthlyLeaseBasisCashFlow * 12) / totalCashInvestedForCoc) * 100 : null;

  const portfolioEquity = Number(data?.portfolioEquity ?? 0);
  const totalPropertyCount = Number((k.totalProperties as { value?: number })?.value ?? data?.totalProperties ?? 0);
  const userName = displayUserName(session?.user?.email, profile?.full_name ?? null);

  const charts = (data?.charts ?? {}) as Record<string, unknown>;
  const mie = (charts.monthlyIncomeExpenses ?? []) as MonthIncomeExpenseRow[];
  const noiTrend = (charts.monthlyNOITrend ?? []) as NoiTrendRow[];

  const incomeChange = formatChangeLine(
    changeFromSeries(mie.map((r) => Number(r.income ?? 0)).filter((n) => Number.isFinite(n))) ??
      changeFromSeries(noiTrend.map((r) => Number(r.income ?? r.noi ?? 0)))
  );

  const cashFlowChange = formatChangeLine(changeFromSeries(mie.map((r) => Number(r.netCashFlow ?? 0))));

  const analysisCols = (
    (k.portfolioAnalysisOverTime as { columns?: Array<{ totalEquity?: number }> })?.columns ?? []
  ).filter((c) => c.totalEquity != null);
  const equityChange =
    analysisCols.length >= 2
      ? formatChangeLine(
          changeFromSeries(analysisCols.map((c) => Number(c.totalEquity))) ??
            null
        )
      : formatChangeLine(null);

  const recentPropertyCards = useMemo((): RecentPropertyCard[] => {
    const leaseIds = new Set(
      ((charts.leaseTimeline as Array<{ propertyId?: string }>) ?? []).map((r) => String(r.propertyId))
    );
    const cashById = new Map(
      ((charts.cashFlowByProperty as Array<{ propertyId?: string; monthlyIncome?: number; netCashFlow?: number }>) ??
        []).map((r) => [String(r.propertyId), r])
    );
    const negativeIds = new Set(
      ((charts.cashFlowByProperty as Array<{ propertyId?: string; netCashFlow?: number }>) ?? [])
        .filter((r) => Number(r.netCashFlow ?? 0) < 0)
        .map((r) => String(r.propertyId))
    );

    return [...properties]
      .sort(
        (a, b) =>
          new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()
      )
      .slice(0, 8)
      .map((p) => {
        const id = String(p.id);
        const cash = cashById.get(id);
        const address = [p.addressLine1, p.city].filter(Boolean).join(", ") || "Address not set";
        const hasLease = leaseIds.has(id);
        const isNegative = negativeIds.has(id);
        return {
          id,
          name: String(p.name ?? "Property"),
          address,
          monthlyRent:
            cash?.monthlyIncome != null
              ? Number(cash.monthlyIncome)
              : Number(p.monthlyRent ?? p.combinedMonthlyLeaseRent ?? 0) || null,
          status: isNegative ? "issue" : hasLease ? "occupied" : "vacant",
          statusLabel: isNegative ? "Cash flow issue" : undefined
        } satisfies RecentPropertyCard;
      });
  }, [properties, charts]);

  const desktopMetrics = (
    <div className="pg-pdash-metrics-row pg-pdash-desktop-only">
      <PortfolioMetricCard
        label="Total Portfolio Value (Net Worth)"
        value={loading && !data ? "…" : fmtZar(portfolioEquity)}
        changeText={equityChange.text}
        changeTone={equityChange.tone}
        icon={Briefcase}
        iconAccent="primary"
      />
      <PortfolioMetricCard
        label="Monthly Income"
        value={loading && !data ? "…" : fmtZar(monthlyIncomeFromLeases)}
        changeText={incomeChange.text}
        changeTone={incomeChange.tone}
        icon={DollarSign}
        iconAccent="success"
      />
      <PortfolioMetricCard
        label="Total Properties"
        value={loading && !data ? "…" : totalPropertyCount.toLocaleString()}
        changeText="— 0% vs last month"
        changeTone="neutral"
        icon={Home}
        iconAccent="info"
      />
      <PortfolioMetricCard
        label="Cash on Cash ROI"
        value={
          loading && !data
            ? "…"
            : cashOnCashAnnualPercent == null
              ? "—"
              : `${cashOnCashAnnualPercent.toFixed(1)}%`
        }
        changeText={cashFlowChange.text}
        changeTone={cashFlowChange.tone}
        icon={Percent}
        iconAccent="warning"
      />
    </div>
  );

  const mobileWelcome = (
    <div className="pg-pdash-welcome pg-pdash-mobile-only">
      <p className="pg-pdash-welcome-kicker">Welcome back,</p>
      <h2 className="pg-pdash-welcome-name">{userName} 👋</h2>
    </div>
  );

  const mobileHero = (
    <div className="pg-pdash-mobile-only">
      <PortfolioMetricCard
        label="Total Portfolio Value (Net Worth)"
        value={loading && !data ? "…" : fmtZar(portfolioEquity)}
        changeText={equityChange.text}
        changeTone={equityChange.tone}
        icon={Briefcase}
        iconAccent="primary"
        highlighted
      />
      <div className="pg-pdash-mobile-stats">
        <PortfolioMetricCard
          label="Properties"
          value={loading && !data ? "…" : totalPropertyCount.toLocaleString()}
          icon={Home}
          iconAccent="info"
          compact
        />
        <PortfolioMetricCard
          label="Tenants"
          value={propertiesLoading ? "…" : tenantCount.toLocaleString()}
          icon={Users}
          iconAccent="primary"
          compact
        />
        <PortfolioMetricCard
          label="Monthly Income"
          value={loading && !data ? "…" : fmtZar(monthlyIncomeFromLeases)}
          icon={DollarSign}
          iconAccent="success"
          compact
        />
      </div>
    </div>
  );

  const mainPanels = hasProperties ? (
    <>
      <div className="pg-pdash-middle pg-pdash-desktop-only">
        <PortfolioOverviewChart data={data} range={chartRange} onRangeChange={setChartRange} />
        <RecentActivityPanel data={data} />
      </div>
      <div className="pg-pdash-desktop-only">
        <RecentPropertiesSection properties={recentPropertyCards} loading={propertiesLoading} />
      </div>
    </>
  ) : null;

  const mobileStack = hasProperties ? (
    <div className="pg-pdash-mobile-stack pg-pdash-mobile-only">
      <RecentPropertiesSection properties={recentPropertyCards} loading={propertiesLoading} />
      <PortfolioOverviewChart data={data} range={chartRange} onRangeChange={setChartRange} />
      <RecentActivityPanel data={data} />
    </div>
  ) : null;

  return (
    <Section>
      <Helmet>
        <title>Portfolio Dashboard | The Property Guy</title>
      </Helmet>
      <Container>
        <PageBreadcrumb items={[PG_WORKSPACE_DASH, { label: "Portfolio overview" }]} />
        <div className="pg-pdash">
          <div className="pg-pdash-toolbar">
            <div>
              <h1 className="pg-h2" style={{ margin: 0 }}>
                Portfolio Dashboard
              </h1>
              <p className="pg-muted" style={{ marginTop: 6 }}>
                Monitor performance, risks and next actions across your portfolio.
              </p>
            </div>
            <div className="pg-pdash-toolbar-actions">
              <Button onClick={() => load()} loading={loading}>
                Refresh
              </Button>
              <Link className="pg-btn pg-btn-secondary" to="/owned-properties/new">
                Add Property
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/financials">
                Add income/expense
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/dashboard">
                My reports
              </Link>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          {!hasProperties && !loading ? (
            <EmptyState
              title="Add your first property"
              body="Track equity, cash flow, tenants, leases and reports across your portfolio."
              actions={
                <>
                  <Link className="pg-btn pg-btn-primary" to="/owned-properties/new">
                    Add Property
                  </Link>
                  <Link className="pg-btn pg-btn-ghost" to="/calculators/cash-on-cash-return">
                    Open Calculators
                  </Link>
                </>
              }
            />
          ) : (
            <>
              {mobileWelcome}
              {desktopMetrics}
              {mobileHero}
              {mainPanels}
              {mobileStack}
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
