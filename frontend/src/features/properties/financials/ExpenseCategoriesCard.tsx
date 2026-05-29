import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { getChartCategoryPalette } from "../../../theme/cssTokens";
import { fmtZar, type PropertyFinancialOverview } from "./propertyFinancialsAdapter";

export function ExpenseCategoriesCard({ overview }: { overview: PropertyFinancialOverview }) {
  const palette = useMemo(() => getChartCategoryPalette(), []);

  const doughnutData = useMemo(() => {
    const labels = overview.expenseCategories.map((c) => c.label);
    const data = overview.expenseCategories.map((c) => c.amount);
    if (!data.length) return null;
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

  return (
    <section className="pg-pfin-section" aria-label="Expense categories">
      <header className="pg-pfin-section__head">
        <h2 className="pg-pfin-section__title">Expense Categories</h2>
        <p className="pg-pfin-section__desc">
          Operating and debt expenses grouped by category (monthly equivalent). Bond slices are debt service, not NOI.
        </p>
      </header>

      {doughnutData ? (
        <div className="pg-pfin-cats__chart" role="img" aria-label="Expense categories donut chart">
          <Doughnut
            data={doughnutData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: { legend: { display: false } }
            }}
          />
        </div>
      ) : (
        <div className="pg-muted">No expense data</div>
      )}

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
          <li className="pg-muted">Expense categories will appear once recurring expenses are added.</li>
        ) : null}
      </ul>
    </section>
  );
}

