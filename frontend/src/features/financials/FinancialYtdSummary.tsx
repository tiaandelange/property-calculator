import { WorkspaceMetricCard, WorkspaceMetricsRow } from "../../components/workspace/WorkspaceMetricCard";
import { fmtZar } from "./financialDirectoryUtils";

export function FinancialYtdSummary({
  year,
  periodLabel,
  revenue,
  expenses,
  cashFlow
}: {
  year: number;
  periodLabel: string;
  revenue: number;
  expenses: number;
  cashFlow: number;
}) {
  return (
    <WorkspaceMetricsRow columns={3}>
      <WorkspaceMetricCard
        label={`Total revenue (${year})`}
        value={fmtZar(revenue)}
        helper={`Received income and paid invoices (${periodLabel})`}
        icon="income"
        accent="success"
      />
      <WorkspaceMetricCard
        label={`Total expenses (${year})`}
        value={fmtZar(expenses)}
        helper={`Active expense ledger entries (${periodLabel})`}
        icon="expense"
        accent="warning"
      />
      <WorkspaceMetricCard
        label={`Cash flow (${year})`}
        value={fmtZar(cashFlow)}
        helper={`Revenue − expenses (${periodLabel})`}
        icon="wallet"
        accent={cashFlow >= 0 ? "success" : "danger"}
        valueStyle={{ color: cashFlow >= 0 ? "var(--success)" : "var(--danger)" }}
      />
    </WorkspaceMetricsRow>
  );
}
