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
import { WorkspaceMetricCard, WorkspaceMetricsRow } from "../components/workspace/WorkspaceMetricCard";
import {
  PORTFOLIO_DASHBOARD_METRIC_INFO,
  resolvePortfolioDashboardKpis
} from "../features/portfolio-dashboard/portfolioDashboardKpis";
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
import { LockedFeaturePreview } from "../lib/subscription/LockedFeaturePreview";
import { usePlanPermissions } from "../lib/subscription/usePlanPermissions";

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
  const permissions = usePlanPermissions();
  const showAdvancedReturns = permissions.canUseFeature("irr");

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

  const dashboardKpis = useMemo(
    () =>
      resolvePortfolioDashboardKpis(data as Record<string, unknown> | null | undefined, properties, {
        propertyTypes: selectedTypes,
        propertyId
      }),
    [data, properties, selectedTypes, propertyId]
  );

  const portfolioEquity = Number(data?.portfolioEquity ?? 0);
  const totalPropertyCount = Number((k.totalProperties as { value?: number })?.value ?? data?.totalProperties ?? 0);
  const occupancyRatePct = Number(data?.occupancyRate ?? 0) * 100;
  const occupiedCount = Number(data?.occupiedProperties ?? 0);
  const tenantRequired = Number(data?.tenantRequiredProperties ?? 0);
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

  const portfolioMetricsDesktop = (
    <div className="pg-pdash-metrics pg-pdash-desktop-only">
      <WorkspaceMetricsRow className="pg-pdash-metrics-primary">
        <WorkspaceMetricCard
          className="pg-pdash-metrics-hero"
          label="Total Portfolio Value (Net Worth)"
          value={loading && !data ? "…" : fmtZar(portfolioEquity)}
          helper={equityChange.text}
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.netWorth}
          icon="portfolio"
          accent="primary"
          to="/owned-properties/metrics/equity"
        />
        <WorkspaceMetricCard
          className="pg-pdash-metric--income"
          label="Monthly Income"
          value={loading && !data ? "…" : fmtZar(dashboardKpis.monthlyIncome)}
          helper={incomeChange.text}
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.monthlyIncome}
          icon="rent"
          accent="success"
          to="/owned-properties/metrics/cash-flow"
        />
        <WorkspaceMetricCard
          className="pg-pdash-metric--properties"
          label="Total Properties"
          value={loading && !data ? "…" : totalPropertyCount.toLocaleString()}
          helper="In your portfolio"
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.totalProperties}
          icon="properties"
          accent="info"
          to="/owned-properties/my-properties"
        />
        <WorkspaceMetricCard
          className="pg-pdash-metric--desktop-only"
          label="Cash on Cash ROI"
          value={
            loading && !data
              ? "…"
              : !showAdvancedReturns
                ? "—"
                : dashboardKpis.cashOnCashAnnualPercent == null
                  ? "—"
                  : `${dashboardKpis.cashOnCashAnnualPercent.toFixed(1)}%`
          }
          helper={!showAdvancedReturns ? "Unlock with Investor plan" : cashFlowChange.text}
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.cashOnCashRoi}
          icon="percent"
          accent="warning"
          to="/owned-properties/metrics/returns"
        />
        <WorkspaceMetricCard
          className="pg-pdash-metric--mobile-only"
          label="Tenants"
          value={propertiesLoading ? "…" : tenantCount.toLocaleString()}
          helper="Active tenants"
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.tenants}
          icon="tenants"
          accent="primary"
          to="/tenants"
        />
      </WorkspaceMetricsRow>
      {desktopLayout.showSecondaryMetrics ? (
        <WorkspaceMetricsRow className="pg-pdash-metrics-secondary">
          <WorkspaceMetricCard
            label="Occupancy Rate"
            value={
              loading && !data
                ? "…"
                : tenantRequired > 0
                  ? `${occupancyRatePct.toFixed(0)}%`
                  : "—"
            }
            helper={
              tenantRequired > 0 ? `${occupiedCount} of ${tenantRequired} occupied` : "No rental units in filter"
            }
            info={PORTFOLIO_DASHBOARD_METRIC_INFO.occupancy}
            icon="activity"
            accent="success"
            to="/owned-properties/metrics/leases"
          />
          <WorkspaceMetricCard
            label="Monthly Cash Flow"
            value={loading && !data ? "…" : fmtZar(dashboardKpis.monthlyCashFlow)}
            helper={cashFlowChange.text}
            info={PORTFOLIO_DASHBOARD_METRIC_INFO.monthlyCashFlow}
            icon="income"
            accent={dashboardKpis.monthlyCashFlow >= 0 ? "success" : "danger"}
            to="/owned-properties/metrics/cash-flow"
          />
          <WorkspaceMetricCard
            label="Monthly Expenses"
            value={loading && !data ? "…" : fmtZar(dashboardKpis.monthlyExpenses)}
            helper="Recurring expenses + bond payments"
            info={PORTFOLIO_DASHBOARD_METRIC_INFO.monthlyExpenses}
            icon="expense"
            accent="info"
            to="/owned-properties/metrics/expenses"
          />
          <WorkspaceMetricCard
            label="Cap Rate"
            value={
              loading && !data
                ? "…"
                : dashboardKpis.capRatePercent == null
                  ? "—"
                  : `${dashboardKpis.capRatePercent.toFixed(2)}%`
            }
            helper={
              dashboardKpis.totalMarketValue > 0
                ? `NOI ${fmtZar(dashboardKpis.monthlyNoi)} / ${fmtZar(dashboardKpis.totalMarketValue)} value`
                : "Add current market values"
            }
            info={PORTFOLIO_DASHBOARD_METRIC_INFO.capRate}
            icon="cap-rate"
            accent="primary"
            to="/owned-properties/metrics/returns"
          />
        </WorkspaceMetricsRow>
      ) : null}
    </div>
  );

  const portfolioMetricsMobile = (
    <div className="pg-pdash-metrics pg-pdash-metrics--mobile pg-pdash-mobile-only">
      <WorkspaceMetricsRow className="pg-pdash-metrics-mobile-hero">
        <WorkspaceMetricCard
          className="pg-pdash-metrics-hero"
          label="Total Portfolio Value (Net Worth)"
          value={loading && !data ? "…" : fmtZar(portfolioEquity)}
          helper={equityChange.text}
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.netWorth}
          icon="portfolio"
          accent="primary"
          to="/owned-properties/metrics/equity"
        />
      </WorkspaceMetricsRow>
      <WorkspaceMetricsRow className="pg-pdash-metrics-mobile-grid">
        <WorkspaceMetricCard
          className="pg-pdash-metric--income"
          label="Monthly Income"
          value={loading && !data ? "…" : fmtZar(dashboardKpis.monthlyIncome)}
          helper={incomeChange.text}
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.monthlyIncome}
          icon="rent"
          accent="success"
          to="/owned-properties/metrics/cash-flow"
        />
        <WorkspaceMetricCard
          label="Cash on Cash ROI"
          value={
            loading && !data
              ? "…"
              : !showAdvancedReturns
                ? "—"
                : dashboardKpis.cashOnCashAnnualPercent == null
                  ? "—"
                  : `${dashboardKpis.cashOnCashAnnualPercent.toFixed(1)}%`
          }
          helper={!showAdvancedReturns ? "Unlock with Investor plan" : cashFlowChange.text}
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.cashOnCashRoi}
          icon="percent"
          accent="warning"
          to="/owned-properties/metrics/returns"
        />
        <WorkspaceMetricCard
          label="Monthly Expenses"
          value={loading && !data ? "…" : fmtZar(dashboardKpis.monthlyExpenses)}
          helper="Recurring expenses + bond payments"
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.monthlyExpenses}
          icon="expense"
          accent="info"
          to="/owned-properties/metrics/expenses"
        />
        <WorkspaceMetricCard
          label="Cap Rate"
          value={
            loading && !data
              ? "…"
              : dashboardKpis.capRatePercent == null
                ? "—"
                : `${dashboardKpis.capRatePercent.toFixed(2)}%`
          }
          helper={
            dashboardKpis.totalMarketValue > 0
              ? `NOI ${fmtZar(dashboardKpis.monthlyNoi)} / ${fmtZar(dashboardKpis.totalMarketValue)} value`
              : "Add current market values"
          }
          info={PORTFOLIO_DASHBOARD_METRIC_INFO.capRate}
          icon="cap-rate"
          accent="primary"
          to="/owned-properties/metrics/returns"
        />
      </WorkspaceMetricsRow>
    </div>
  );

  const mobileWelcome = (
    <div className="pg-pdash-welcome pg-pdash-mobile-only">
      <p className="pg-pdash-welcome-kicker">Welcome back,</p>
      <h2 className="pg-pdash-welcome-name">{userName} 👋</h2>
    </div>
  );

  const mainPanels = hasProperties ? (
    <>
      <div className="pg-pdash-middle pg-pdash-desktop-only">
        <LockedFeaturePreview
          feature="graphs"
          title="Unlock portfolio charts with Investor."
          className="pg-pdash-chart-lock"
        >
          <PortfolioOverviewChart data={data} range={chartRange} onRangeChange={setChartRange} />
        </LockedFeaturePreview>
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
      <LockedFeaturePreview feature="graphs" title="Unlock portfolio charts with Investor.">
        <PortfolioOverviewChart data={data} range={chartRange} onRangeChange={setChartRange} />
      </LockedFeaturePreview>
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
              <div className="pg-pdash-desktop-only">
                <MetricCardsSkeletonRow count={4} />
                {desktopLayout.showSecondaryMetrics ? <MetricCardsSkeletonRow count={4} /> : null}
              </div>
              <div className="pg-pdash-metrics-mobile-skeleton pg-pdash-mobile-only">
                <div className="pg-metric-card-skeleton pg-pdash-metrics-mobile-hero-skeleton" aria-hidden />
                <MetricCardsSkeletonRow count={4} />
              </div>
              <SkeletonGrid count={2} columns={2} />
            </>
          ) : (
            <>
              {mobileWelcome}
              {portfolioMetricsDesktop}
              {portfolioMetricsMobile}
              {mainPanels}
              {mobileStack}
            </>
          )}
    </AppListPage>
  );
}
