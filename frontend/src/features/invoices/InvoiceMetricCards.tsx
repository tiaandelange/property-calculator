import { WorkspaceMetricCard, WorkspaceMetricsRow } from "../../components/workspace/WorkspaceMetricCard";
import { fmtZar } from "./invoiceDirectoryUtils";
import type { InvoiceDirectoryMetrics } from "./invoiceDirectoryTypes";

export function InvoiceMetricCards({
  metrics,
  loading
}: {
  metrics: InvoiceDirectoryMetrics;
  loading?: boolean;
}) {
  return (
    <WorkspaceMetricsRow>
      <WorkspaceMetricCard
        label="Total Outstanding"
        value={loading ? "…" : fmtZar(metrics.totalOutstanding)}
        helper="Unpaid invoice balance"
        icon="wallet"
        accent="info"
      />
      <WorkspaceMetricCard
        label="Due This Month"
        value={loading ? "…" : fmtZar(metrics.dueThisMonth)}
        helper="Due in current month"
        icon="calendar"
        accent="warning"
      />
      <WorkspaceMetricCard
        label="Overdue"
        value={loading ? "…" : fmtZar(metrics.overdue)}
        helper="Past due and unpaid"
        icon="warning"
        accent="danger"
      />
      <WorkspaceMetricCard
        label="Paid This Month"
        value={loading ? "…" : fmtZar(metrics.paidThisMonth)}
        helper="Paid invoices"
        icon="success"
        accent="success"
      />
    </WorkspaceMetricsRow>
  );
}
