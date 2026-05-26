import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Home, Lightbulb } from "lucide-react";
import { getChartCategoryPalette, getChartSemanticColors } from "../../../theme/cssTokens";
import { fmtZar, type PropertyFinancialOverview } from "./propertyFinancialsAdapter";

export function PropertyFinancialSummaryPanel({
  overview,
  propertyName,
  unitLabel,
  addressLine
}: {
  overview: PropertyFinancialOverview;
  propertyName: string;
  unitLabel: string | null;
  addressLine: string | null;
}) {
  const colors = useMemo(() => getChartSemanticColors(), []);
  const palette = useMemo(() => getChartCategoryPalette(), []);

  const doughnutData = useMemo(() => {
    const labels = overview.expenseCategories.map((c) => c.label);
    const data = overview.expenseCategories.map((c) => c.amount);
    if (!data.length) {
      return null;
    }
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 0
        }
      ]
    };
  }, [overview.expenseCategories, palette]);

  const leaseBadgeClass =
    overview.leaseStatus === "Active"
      ? "pg-pfin-summary__badge pg-pfin-summary__badge--success"
      : overview.leaseStatus === "Vacant"
        ? "pg-pfin-summary__badge pg-pfin-summary__badge--warning"
        : "pg-pfin-summary__badge pg-pfin-summary__badge--danger";

  return (
    <aside className="pg-pfin-summary" aria-label="Financial summary">
      <div className="pg-pfin-summary__card">
        <div className="pg-pfin-summary__hero" aria-hidden>
          <Home size={28} strokeWidth={1.75} />
        </div>
        <h2 className="pg-pfin-summary__title">Financial Summary</h2>
        <p className="pg-pfin-summary__property">{propertyName}</p>
        {unitLabel || addressLine ? (
          <p className="pg-pfin-summary__meta">
            {[unitLabel ? `Unit ${unitLabel}` : null, addressLine].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        <dl className="pg-pfin-summary__facts">
          <div>
            <dt>Gross rental income</dt>
            <dd className="pg-pfin-summary__pos">{fmtZar(overview.grossRentalIncome)}</dd>
          </div>
          <div>
            <dt>Total monthly expenses</dt>
            <dd className="pg-pfin-summary__neg">{fmtZar(overview.totalMonthlyExpenses)}</dd>
          </div>
          <div>
            <dt>Net operating income</dt>
            <dd className={overview.netOperatingIncome >= 0 ? "pg-pfin-summary__pos" : "pg-pfin-summary__neg"}>
              {fmtZar(overview.netOperatingIncome)}
            </dd>
          </div>
          <div>
            <dt>Estimated cash flow</dt>
            <dd className={overview.estimatedCashFlow >= 0 ? "pg-pfin-summary__pos" : "pg-pfin-summary__neg"}>
              {fmtZar(overview.estimatedCashFlow)}
            </dd>
          </div>
          <div>
            <dt>Annual yield / ROI</dt>
            <dd className="pg-pfin-summary__roi">
              {overview.annualYieldPercent != null ? `${overview.annualYieldPercent}%` : "—"}
            </dd>
          </div>
        </dl>

        <span className={leaseBadgeClass}>Lease: {overview.leaseStatus}</span>

        <div className="pg-pfin-summary__bar-block">
          <div className="pg-pfin-summary__bar-head">
            <span>Income vs expenses</span>
            <span>
              {overview.incomePct}% / {overview.expensePct}%
            </span>
          </div>
          <div className="pg-pfin-summary__bar" role="img" aria-label={`Income ${overview.incomePct} percent, expenses ${overview.expensePct} percent`}>
            <div className="pg-pfin-summary__bar-income" style={{ width: `${overview.incomePct}%` }} />
            <div className="pg-pfin-summary__bar-expense" style={{ width: `${overview.expensePct}%` }} />
          </div>
          <div className="pg-pfin-summary__bar-legend">
            <span>
              <i className="pg-pfin-dot pg-pfin-dot--income" /> Income
            </span>
            <span>
              <i className="pg-pfin-dot pg-pfin-dot--expense" /> Expenses
            </span>
          </div>
        </div>

        <div className="pg-pfin-summary__categories">
          <h3 className="pg-pfin-summary__subheading">Expense categories</h3>
          {doughnutData ? (
            <div className="pg-pfin-summary__chart">
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: { legend: { display: false } }
                }}
              />
            </div>
          ) : null}
          <ul className="pg-pfin-category-list">
            {overview.expenseCategories.map((c, i) => (
              <li key={c.key}>
                <span className="pg-pfin-dot" style={{ background: palette[i % palette.length] }} />
                <span className="pg-pfin-category-list__label">{c.label}</span>
                <span className="pg-pfin-category-list__amt">{fmtZar(c.amount)}</span>
                <span className="pg-pfin-category-list__pct">{c.pct}%</span>
              </li>
            ))}
            {overview.expenseCategories.length === 0 ? (
              <li className="pg-muted">No recurring expense categories yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="pg-pfin-summary__tip">
          <Lightbulb size={18} aria-hidden style={{ color: colors.primary }} />
          <p>Keep recurring expenses updated to improve portfolio reporting and cash-flow accuracy.</p>
        </div>
      </div>
    </aside>
  );
}
