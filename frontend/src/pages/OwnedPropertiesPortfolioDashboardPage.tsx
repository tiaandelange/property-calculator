import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { AppListPage } from "../components/ui/AppPage";
import { ButtonLink } from "../components/ui/Button";
import { AddPropertyButton } from "../features/subscription/AddPropertyButton";
import { EmptyState, SkeletonGrid } from "../components/ui/DashboardKit";
import { MetricCardsSkeletonRow } from "../components/ui/PageSkeletons";
import { QueryErrorCard } from "../components/ui/QueryState";
import { PortfolioDashboardFilters } from "../components/nav/portfolio/PortfolioDashboardFilters";
import { useAuth } from "../contexts/AuthContext";
import { asArray } from "../lib/asArray";
import {
  isInitialQueryLoad,
  queryKeys,
  useDashboardSummaryQuery,
  usePropertiesQuery,
  useTenantsListQuery,
  useWorkspaceId
} from "../features/queries";
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
import { usePortfolioDesktopLayout } from "../features/portfolio-dashboard/usePortfolioDesktopLayout";
import { PortfolioAnalysisSplitSection } from "../features/portfolio-dashboard/PortfolioAnalysisSplitSection";

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
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { session, profile } = useAuth();
  const selectedTypes = useMemo(() => parseTypesParam(search), [search]);
  const month = useMemo(
    () => parseMonthParam(search) ?? new Date().toISOString().slice(0, 7),
    [search]
  );
  const propertyId = useMemo(() => parsePropertyParam(search), [search]);
  const [chartRange, setChartRange] = useState<PortfolioChartRange>("THIS_YEAR");
  const desktopLayout = usePortfolioDesktopLayout();

  const summaryQuery = useDashboardSummaryQuery({
    propertyTypes: selectedTypes,
    month,
    propertyId
  });
  const propertiesQuery = usePropertiesQuery();
  const tenantsQuery = useTenantsListQuery();

  const data = (summaryQuery.data ?? null) as Record<string, unknown> | null;
  const properties = (propertiesQuery.data ?? []) as Record<string, unknown>[];
  const tenantCount = Array.isArray(tenantsQuery.data) ? tenantsQuery.data.length : 0;
  const loading = isInitialQueryLoad(summaryQuery);
  const propertiesLoading = isInitialQueryLoad(propertiesQuery);
  const error = summaryQuery.error
    ? ((summaryQuery.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data
        ?.message ??
        (summaryQuery.error instanceof Error ? summaryQuery.error.message : "Failed to load portfolio dashboard."))
    : "";

  const refreshDashboard = () => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dashboardSummary(workspaceId, {
        propertyTypes: selectedTypes,
        month,
        propertyId
      })
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.properties(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tenants(workspaceId, { list: true }) });
  };

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
  const occupancyRatePct = Number(data?.occupancyRate ?? 0) * 100;
  const occupiedCount = Number(data?.occupiedProperties ?? 0);
  const tenantRequired = Number(data?.tenantRequiredProperties ?? 0);
  const rentOverdue = Number((data?.rentDue as { overdue?: number })?.overdue ?? 0);
  const rentDueSoon = Number((data?.rentDue as { dueSoon?: number })?.dueSoon ?? 0);
  const rentAttention = rentOverdue + rentDueSoon;
  const userName = displayUserName(session?.user?.email, profile?.full_name ?? null);

  const charts = (data?.charts ?? {}) as Record<string, unknown>;
  const mie = asArray<MonthIncomeExpenseRow>(charts.monthlyIncomeExpenses);
  const noiTrend = asArray<NoiTrendRow>(charts.monthlyNOITrend);

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
      asArray<{ propertyId?: string }>(charts.leaseTimeline).map((r) => String(r.propertyId))
    );
    const cashById = new Map(
      asArray<{ propertyId?: string; monthlyIncome?: number; netCashFlow?: number }>(charts.cashFlowByProperty).map(
        (r) => [String(r.propertyId), r]
      )
    );
    const negativeIds = new Set(
      asArray<{ propertyId?: string; netCashFlow?: number }>(charts.cashFlowByProperty)
        .filter((r) => Number(r.netCashFlow ?? 0) < 0)
        .map((r) => String(r.propertyId))
    );

    return [...properties]
      .sort(
        (a, b) =>
          new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()
      )
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

  const cashFlowTone = monthlyLeaseBasisCashFlow >= 0 ? "up" : "down";

  const desktopMetrics = (
    <>
      <div className="pg-pdash-metrics-row pg-pdash-metrics-row--primary pg-pdash-desktop-only">
        <PortfolioMetricCard
          label="Total Portfolio Value (Net Worth)"
          value={loading && !data ? "…" : fmtZar(portfolioEquity)}
          changeText={equityChange.text}
          changeTone={equityChange.tone}
          icon="portfolio"
          iconAccent="primary"
          to="/owned-properties/metrics/equity"
        />
        <PortfolioMetricCard
          label="Monthly Income"
          value={loading && !data ? "…" : fmtZar(monthlyIncomeFromLeases)}
          changeText={incomeChange.text}
          changeTone={incomeChange.tone}
          icon="rent"
          iconAccent="success"
          to="/owned-properties/metrics/cash-flow"
        />
        <PortfolioMetricCard
          label="Total Properties"
          value={loading && !data ? "…" : totalPropertyCount.toLocaleString()}
          changeText="— 0% vs last month"
          changeTone="neutral"
          icon="properties"
          iconAccent="info"
          to="/owned-properties/my-properties"
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
          icon="percent"
          iconAccent="warning"
          to="/owned-properties/metrics/returns"
        />
      </div>
      {desktopLayout.showSecondaryMetrics ? (
        <div className="pg-pdash-metrics-row pg-pdash-metrics-row--secondary pg-pdash-desktop-only">
          <PortfolioMetricCard
            label="Occupancy Rate"
            value={
              loading && !data
                ? "…"
                : tenantRequired > 0
                  ? `${occupancyRatePct.toFixed(0)}%`
                  : "—"
            }
            changeText={
              tenantRequired > 0 ? `${occupiedCount} of ${tenantRequired} occupied` : "No rental units in filter"
            }
            changeTone="neutral"
            icon="activity"
            iconAccent="success"
            to="/owned-properties/metrics/leases"
          />
          <PortfolioMetricCard
            label="Monthly Cash Flow"
            value={loading && !data ? "…" : fmtZar(monthlyLeaseBasisCashFlow)}
            changeText={cashFlowChange.text}
            changeTone={cashFlowTone}
            icon="income"
            iconAccent={monthlyLeaseBasisCashFlow >= 0 ? "success" : "danger"}
            to="/owned-properties/metrics/cash-flow"
          />
          <PortfolioMetricCard
            label="Monthly Expenses"
            value={loading && !data ? "…" : fmtZar(monthlyExpensesAllIn)}
            changeText="Operating + bond payments"
            changeTone="neutral"
            icon="expense"
            iconAccent="info"
            to="/owned-properties/metrics/expenses"
          />
          <PortfolioMetricCard
            label="Rent Attention"
            value={loading && !data ? "…" : rentAttention.toLocaleString()}
            changeText={
              rentOverdue > 0
                ? `${rentOverdue} overdue`
                : rentDueSoon > 0
                  ? `${rentDueSoon} due soon`
                  : "All clear"
            }
            changeTone={rentOverdue > 0 ? "down" : rentDueSoon > 0 ? "neutral" : "up"}
            icon="rent"
            iconAccent={rentOverdue > 0 ? "danger" : "warning"}
            to="/financials"
          />
        </div>
      ) : null}
    </>
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
        icon="portfolio"
        iconAccent="primary"
        highlighted
      />
      <div className="pg-pdash-mobile-stats">
        <PortfolioMetricCard
          label="Properties"
          value={loading && !data ? "…" : totalPropertyCount.toLocaleString()}
          icon="properties"
          iconAccent="info"
          compact
        />
        <PortfolioMetricCard
          label="Tenants"
          value={propertiesLoading ? "…" : tenantCount.toLocaleString()}
          icon="tenants"
          iconAccent="primary"
          compact
        />
        <PortfolioMetricCard
          label="Monthly Income"
          value={loading && !data ? "…" : fmtZar(monthlyIncomeFromLeases)}
          icon="rent"
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
        <RecentActivityPanel data={data} limit={desktopLayout.activityLimit} />
      </div>
      <div className="pg-pdash-desktop-only">
        <PortfolioAnalysisSplitSection
          data={data}
          properties={properties}
          propertyTypes={selectedTypes}
          propertyId={propertyId}
        />
      </div>
      <div className="pg-pdash-desktop-only">
        <RecentPropertiesSection
          properties={recentPropertyCards}
          loading={propertiesLoading}
          limit={desktopLayout.propertyLimit}
        />
      </div>
    </>
  ) : null;

  const mobileStack = hasProperties ? (
    <div className="pg-pdash-mobile-stack pg-pdash-mobile-only">
      <PortfolioOverviewChart data={data} range={chartRange} onRangeChange={setChartRange} />
      <RecentActivityPanel data={data} />
      <PortfolioAnalysisSplitSection
        data={data}
        properties={properties}
        propertyTypes={selectedTypes}
        propertyId={propertyId}
      />
      <RecentPropertiesSection properties={recentPropertyCards} loading={propertiesLoading} />
    </div>
  ) : null;

  return (
    <AppListPage contentClassName={`pg-pdash pg-pdash--${desktopLayout.tier}`}>
      <Helmet>
        <title>Portfolio Dashboard | The Property Guy</title>
      </Helmet>
          <div className="pg-pdash-toolbar">
            <div className="pg-pdash-toolbar-actions">
              <PortfolioDashboardFilters />
              <ButtonLink href="/dashboard" variant="ghost">
                My reports
              </ButtonLink>
            </div>
          </div>

          {error ? (
            <QueryErrorCard
              message={error}
              onRetry={() => refreshDashboard()}
              retrying={summaryQuery.isFetching}
            />
          ) : null}

          {!hasProperties && !loading && !error ? (
            <EmptyState
              title="Add your first property"
              body="Track equity, cash flow, tenants, leases and reports across your portfolio."
              actions={
                <>
                  <AddPropertyButton variant="primary" />
                  <ButtonLink href="/calculators/cash-on-cash-return" variant="ghost">
                    Open Calculators
                  </ButtonLink>
                </>
              }
            />
          ) : loading && !data ? (
            <>
              {mobileWelcome}
              <MetricCardsSkeletonRow count={4} />
              {desktopLayout.showSecondaryMetrics ? <MetricCardsSkeletonRow count={4} /> : null}
              <SkeletonGrid count={2} columns={2} />
            </>
          ) : (
            <>
              {mobileWelcome}
              {desktopMetrics}
              {mobileHero}
              {mainPanels}
              {mobileStack}
            </>
          )}
    </AppListPage>
  );
}
