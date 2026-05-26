import { ArrowDownCircle, ArrowUpCircle, Building2, TrendingUp } from "lucide-react";
import { PortfolioMetricCard } from "../portfolio-dashboard/PortfolioMetricCard";
import type { FinancialDirectoryMetrics } from "./financialDirectoryTypes";
import { fmtZar, propertyFinancialsStatementUrl } from "./financialDirectoryUtils";

export function FinancialMetricCards({
  metrics,
  loading,
  propertyId
}: {
  metrics: FinancialDirectoryMetrics;
  loading?: boolean;
  propertyId: string;
}) {
  const finTo =
    propertyId !== "ALL" ? propertyFinancialsStatementUrl(propertyId) : "/financials";
  const cashTone = metrics.netCashFlow >= 0 ? "up" : "down";

  const desktop = (
    <div className="pg-fins-metrics pg-fins-metrics--desktop pg-fins-desktop-only">
      <PortfolioMetricCard
        label="Income (this month)"
        value={loading ? "…" : fmtZar(metrics.receivedThisMonth)}
        changeText={
          metrics.expectedThisMonth > 0
            ? `${fmtZar(metrics.expectedThisMonth)} expected`
            : "Received ledger + paid invoices"
        }
        changeTone="neutral"
        icon={ArrowUpCircle}
        iconAccent="success"
        to={finTo}
      />
      <PortfolioMetricCard
        label="Expenses (this month)"
        value={loading ? "…" : fmtZar(metrics.expensesThisMonth + metrics.bondThisMonth)}
        changeText={metrics.bondThisMonth > 0 ? `Includes ${fmtZar(metrics.bondThisMonth)} bond` : "Operating + bond"}
        changeTone="neutral"
        icon={ArrowDownCircle}
        iconAccent="warning"
        to={finTo}
      />
      <PortfolioMetricCard
        label="Net cash flow"
        value={loading ? "…" : fmtZar(metrics.netCashFlow)}
        changeText="Selected month · all filtered properties"
        changeTone={cashTone}
        icon={TrendingUp}
        iconAccent={metrics.netCashFlow >= 0 ? "success" : "danger"}
        to={finTo}
      />
      <PortfolioMetricCard
        label="Properties"
        value={loading ? "…" : metrics.propertyCount.toLocaleString()}
        changeText="In current filter"
        changeTone="neutral"
        icon={Building2}
        iconAccent="info"
        to="/owned-properties/my-properties"
      />
    </div>
  );

  const mobile = (
    <div className="pg-fins-metrics pg-fins-metrics--mobile pg-fins-mobile-only">
      <PortfolioMetricCard
        label="Net cash flow"
        value={loading ? "…" : fmtZar(metrics.netCashFlow)}
        icon={TrendingUp}
        iconAccent={metrics.netCashFlow >= 0 ? "success" : "danger"}
        highlighted
        compact
      />
      <div className="pg-fins-metrics-row">
        <PortfolioMetricCard
          label="Income"
          value={loading ? "…" : fmtZar(metrics.receivedThisMonth)}
          icon={ArrowUpCircle}
          iconAccent="success"
          compact
        />
        <PortfolioMetricCard
          label="Expenses"
          value={loading ? "…" : fmtZar(metrics.expensesThisMonth + metrics.bondThisMonth)}
          icon={ArrowDownCircle}
          iconAccent="warning"
          compact
        />
      </div>
    </div>
  );

  return (
    <>
      {desktop}
      {mobile}
    </>
  );
}
