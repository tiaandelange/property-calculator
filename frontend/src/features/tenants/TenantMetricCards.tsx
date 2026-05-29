import { PortfolioMetricCard } from "../portfolio-dashboard/PortfolioMetricCard";
import { fmtZar } from "./tenantDirectoryUtils";
import type { TenantDirectoryMetrics } from "./tenantDirectoryTypes";

export function TenantMetricCards({
  metrics,
  loading
}: {
  metrics: TenantDirectoryMetrics;
  loading?: boolean;
}) {
  return (
    <>
      <div className="pg-tenants-metrics pg-tenants-metrics--desktop">
        <PortfolioMetricCard
          label="Total Tenants"
          value={loading ? "…" : metrics.totalTenants.toLocaleString()}
          changeText="Current portfolio"
          changeTone="neutral"
          icon="tenants"
          iconAccent="primary"
        />
        <PortfolioMetricCard
          label="Active Leases"
          value={loading ? "…" : metrics.activeLeases.toLocaleString()}
          changeText="Active leases"
          changeTone="up"
          icon="verified"
          iconAccent="success"
          to="/leases"
        />
        <PortfolioMetricCard
          label="Pending Payments"
          value={loading ? "…" : fmtZar(metrics.pendingPaymentsTotal)}
          changeText={
            metrics.pendingPaymentsCount > 0
              ? `${metrics.pendingPaymentsCount} tenant${metrics.pendingPaymentsCount === 1 ? "" : "s"} with balance`
              : "All clear"
          }
          changeTone={metrics.pendingPaymentsCount > 0 ? "down" : "up"}
          icon="payments"
          iconAccent="warning"
          to="/financials"
        />
        <PortfolioMetricCard
          label="Renewals Due"
          value={loading ? "…" : metrics.renewalsDue.toLocaleString()}
          changeText="Next 30 days"
          changeTone={metrics.renewalsDue > 0 ? "neutral" : "up"}
          icon="calendar"
          iconAccent="info"
          to="/leases"
        />
      </div>
      <div className="pg-tenants-metrics pg-tenants-metrics--mobile">
        <PortfolioMetricCard
          label="Total Tenants"
          value={loading ? "…" : metrics.totalTenants.toLocaleString()}
          changeText="Portfolio"
          changeTone="neutral"
          icon="tenants"
          iconAccent="primary"
          compact
        />
        <PortfolioMetricCard
          label="Active Leases"
          value={loading ? "…" : metrics.activeLeases.toLocaleString()}
          icon="verified"
          iconAccent="success"
          compact
        />
        <PortfolioMetricCard
          label="Pending"
          value={loading ? "…" : fmtZar(metrics.pendingPaymentsTotal)}
          icon="payments"
          iconAccent="warning"
          compact
        />
        <PortfolioMetricCard
          label="Renewals"
          value={loading ? "…" : metrics.renewalsDue.toLocaleString()}
          changeText="30 days"
          changeTone="neutral"
          icon="calendar"
          iconAccent="info"
          compact
        />
      </div>
    </>
  );
}
