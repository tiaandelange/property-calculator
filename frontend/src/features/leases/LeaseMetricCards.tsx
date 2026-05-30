import { WorkspaceMetricCard, WorkspaceMetricsRow } from "../../components/workspace/WorkspaceMetricCard";
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
    <WorkspaceMetricsRow>
      <WorkspaceMetricCard
        label="Total Leases"
        value={loading ? "…" : metrics.totalLeases.toLocaleString()}
        helper="All lease records"
        icon="leases"
        accent="primary"
      />
      <WorkspaceMetricCard
        label="Active Leases"
        value={loading ? "…" : metrics.activeLeases.toLocaleString()}
        helper="Currently active"
        icon="properties"
        accent="success"
      />
      <WorkspaceMetricCard
        label="Monthly Rent Roll"
        value={loading ? "…" : fmtZar(metrics.monthlyRentRoll)}
        helper="Active leases combined"
        icon="wallet"
        accent="info"
      />
      <WorkspaceMetricCard
        label="Renewals Due"
        value={loading ? "…" : metrics.renewalsDue.toLocaleString()}
        helper="Next 30 days"
        icon="calendar"
        accent="warning"
      />
    </WorkspaceMetricsRow>
  );
}
