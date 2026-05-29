import { PortfolioMetricCard } from "../portfolio-dashboard/PortfolioMetricCard";
import { fmtZar } from "./leaseDirectoryUtils";
import type { LeaseDirectoryMetrics } from "./leaseDirectoryTypes";

export function LeaseMetricCards({
  metrics,
  loading
}: {
  metrics: LeaseDirectoryMetrics;
  loading?: boolean;
}) {
  return (
    <>
      <div className="pg-leases-metrics pg-leases-metrics--desktop">
        <PortfolioMetricCard
          label="Total Leases"
          value={loading ? "…" : metrics.totalLeases.toLocaleString()}
          changeText="All lease records"
          changeTone="neutral"
          icon="leases"
          iconAccent="primary"
        />
        <PortfolioMetricCard
          label="Active Leases"
          value={loading ? "…" : metrics.activeLeases.toLocaleString()}
          changeText="Currently active"
          changeTone="up"
          icon="properties"
          iconAccent="success"
        />
        <PortfolioMetricCard
          label="Monthly Rent Roll"
          value={loading ? "…" : fmtZar(metrics.monthlyRentRoll)}
          changeText="Active leases combined"
          changeTone="neutral"
          icon="wallet"
          iconAccent="info"
        />
        <PortfolioMetricCard
          label="Renewals Due"
          value={loading ? "…" : metrics.renewalsDue.toLocaleString()}
          changeText="Next 30 days"
          changeTone={metrics.renewalsDue > 0 ? "neutral" : "up"}
          icon="calendar"
          iconAccent="warning"
        />
      </div>
      <div className="pg-leases-metrics pg-leases-metrics--mobile">
        <PortfolioMetricCard label="Total" value={loading ? "…" : metrics.totalLeases.toLocaleString()} icon="leases" iconAccent="primary" compact />
        <PortfolioMetricCard label="Active" value={loading ? "…" : metrics.activeLeases.toLocaleString()} icon="properties" iconAccent="success" compact />
        <PortfolioMetricCard label="Rent roll" value={loading ? "…" : fmtZar(metrics.monthlyRentRoll)} icon="wallet" iconAccent="info" compact />
        <PortfolioMetricCard label="Renewals" value={loading ? "…" : metrics.renewalsDue.toLocaleString()} changeText="30 days" changeTone="neutral" icon="calendar" iconAccent="warning" compact />
      </div>
    </>
  );
}
