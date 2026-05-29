import { AlertCircle, CalendarClock, CheckCircle2, Wallet } from "lucide-react";
import { PortfolioMetricCard } from "../portfolio-dashboard/PortfolioMetricCard";
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
    <>
      <div className="pg-invoices-metrics pg-invoices-metrics--desktop">
        <PortfolioMetricCard
          label="Total Outstanding"
          value={loading ? "…" : fmtZar(metrics.totalOutstanding)}
          changeText="Unpaid invoice balance"
          changeTone={metrics.totalOutstanding > 0 ? "neutral" : "up"}
          icon={Wallet}
          iconAccent="info"
        />
        <PortfolioMetricCard
          label="Due This Month"
          value={loading ? "…" : fmtZar(metrics.dueThisMonth)}
          changeText="Due in current month"
          changeTone="neutral"
          icon={CalendarClock}
          iconAccent="warning"
        />
        <PortfolioMetricCard
          label="Overdue"
          value={loading ? "…" : fmtZar(metrics.overdue)}
          changeText="Past due and unpaid"
          changeTone={metrics.overdue > 0 ? "neutral" : "up"}
          icon={AlertCircle}
          iconAccent="danger"
        />
        <PortfolioMetricCard
          label="Paid This Month"
          value={loading ? "…" : fmtZar(metrics.paidThisMonth)}
          changeText="Paid invoices"
          changeTone="up"
          icon={CheckCircle2}
          iconAccent="success"
        />
      </div>
      <div className="pg-invoices-metrics pg-invoices-metrics--mobile">
        <PortfolioMetricCard label="Outstanding" value={loading ? "…" : fmtZar(metrics.totalOutstanding)} icon={Wallet} iconAccent="info" compact />
        <PortfolioMetricCard label="Due month" value={loading ? "…" : fmtZar(metrics.dueThisMonth)} icon={CalendarClock} iconAccent="warning" compact />
        <PortfolioMetricCard label="Overdue" value={loading ? "…" : fmtZar(metrics.overdue)} icon={AlertCircle} iconAccent="danger" compact />
        <PortfolioMetricCard label="Paid month" value={loading ? "…" : fmtZar(metrics.paidThisMonth)} icon={CheckCircle2} iconAccent="success" compact />
      </div>
    </>
  );
}
