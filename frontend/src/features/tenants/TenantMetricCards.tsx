import { WorkspaceMetricCard, WorkspaceMetricsRow } from "../../components/workspace/WorkspaceMetricCard";
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
    <WorkspaceMetricsRow>
      <WorkspaceMetricCard
        label="Total Tenants"
        value={loading ? "…" : metrics.totalTenants.toLocaleString()}
        helper="Current portfolio"
        icon="tenants"
        accent="primary"
      />
      <WorkspaceMetricCard
        label="Active Leases"
        value={loading ? "…" : metrics.activeLeases.toLocaleString()}
        helper="Active leases"
        icon="verified"
        accent="success"
        to="/leases"
      />
      <WorkspaceMetricCard
        label="Pending Payments"
        value={loading ? "…" : fmtZar(metrics.pendingPaymentsTotal)}
        helper={
          metrics.pendingPaymentsCount > 0
            ? `${metrics.pendingPaymentsCount} tenant${metrics.pendingPaymentsCount === 1 ? "" : "s"} with balance`
            : "All clear"
        }
        icon="payments"
        accent="warning"
        to="/financials"
      />
      <WorkspaceMetricCard
        label="Renewals Due"
        value={loading ? "…" : metrics.renewalsDue.toLocaleString()}
        helper="Next 30 days"
        icon="calendar"
        accent="info"
        to="/leases"
      />
    </WorkspaceMetricsRow>
  );
}
