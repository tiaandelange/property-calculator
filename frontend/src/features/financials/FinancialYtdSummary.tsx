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
    <div className="pg-fin-ytd-grid">
      <div className="pg-fin-ytd-card">
        <div className="pg-fin-ytd-card-title">Total revenue ({year})</div>
        <div className="pg-fin-ytd-card-value">{fmtZar(revenue)}</div>
        <div className="pg-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Received income and paid invoices ({periodLabel})
        </div>
      </div>
      <div className="pg-fin-ytd-card">
        <div className="pg-fin-ytd-card-title">Total expenses ({year})</div>
        <div className="pg-fin-ytd-card-value">{fmtZar(expenses)}</div>
        <div className="pg-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Active expense ledger entries ({periodLabel})
        </div>
      </div>
      <div className="pg-fin-ytd-card">
        <div className="pg-fin-ytd-card-title">Cash flow ({year})</div>
        <div className="pg-fin-ytd-card-value" style={{ color: cashFlow >= 0 ? "var(--success)" : "var(--danger)" }}>
          {fmtZar(cashFlow)}
        </div>
        <div className="pg-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Revenue − expenses ({periodLabel})
        </div>
      </div>
    </div>
  );
}
