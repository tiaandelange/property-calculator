import { WorkspaceMetricCard, WorkspaceMetricsRow } from "../../components/workspace/WorkspaceMetricCard";
import { fmtZar } from "./tenantDirectoryUtils";
import type { ApplicantDirectoryMetrics, TenantDirectoryMetrics } from "./tenantDirectoryTypes";

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

export function ApplicantMetricCards({
  metrics,
  loading
}: {
  metrics: ApplicantDirectoryMetrics;
  loading?: boolean;
}) {
  return (
    <WorkspaceMetricsRow>
      <WorkspaceMetricCard
        label="Total Applicants"
        value={loading ? "…" : metrics.totalApplicants.toLocaleString()}
        helper="In your pipeline"
        icon="applicants"
        accent="primary"
      />
      <WorkspaceMetricCard
        label="Awaiting Property"
        value={loading ? "…" : metrics.awaitingProperty.toLocaleString()}
        helper="Not linked yet"
        icon="properties"
        accent="info"
      />
      <WorkspaceMetricCard
        label="Linked to Property"
        value={loading ? "…" : metrics.linkedToProperty.toLocaleString()}
        helper="Property selected"
        icon="tenants"
        accent="success"
      />
      <WorkspaceMetricCard
        label="Ready for Lease"
        value={loading ? "…" : metrics.readyForLease.toLocaleString()}
        helper="Linked, no lease yet"
        icon="leases"
        accent="warning"
        to="/leases/new"
      />
    </WorkspaceMetricsRow>
  );
}
