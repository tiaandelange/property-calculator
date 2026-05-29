import { IconContainer } from "../../../components/icons";
import type { IconContainerAccent } from "../../../components/icons";
import type { IconName } from "../../../components/icons";
import { fmtZar } from "./propertyFinancialsAdapter";
import type { PropertyFinancialOverview } from "./propertyFinancialsAdapter";

export function PropertyFinancialMetricCards({
  overview,
  compact
}: {
  overview: PropertyFinancialOverview;
  compact?: boolean;
}) {
  const cashAccent = overview.netCashFlow >= 0 ? ("success" as const) : ("danger" as const);
  const statusAccent =
    overview.occupancyStatus === "Occupied"
      ? ("success" as const)
      : overview.occupancyStatus === "Partially rented"
        ? ("info" as const)
        : overview.occupancyStatus === "Vacant"
          ? ("warning" as const)
          : ("info" as const);

  const cards: Array<{
    key: string;
    label: string;
    value: string;
    helper: string;
    icon: IconName;
    accent: IconContainerAccent;
  }> = [
    {
      key: "income",
      label: "Monthly Income",
      value: fmtZar(overview.monthlyIncome),
      helper: "Gross rental income",
      icon: "rent",
      accent: "success"
    },
    {
      key: "expenses",
      label: "Operating Expenses",
      value: fmtZar(overview.totalRecurringExpenses),
      helper: "Operating expenses excl. debt",
      icon: "expense",
      accent: "warning"
    },
    {
      key: "cashflow",
      label: "Net Cash Flow",
      value: fmtZar(overview.netCashFlow),
      helper: "Income after operating & debt",
      icon: "income",
      accent: cashAccent
    },
    {
      key: "status",
      label: "Occupancy / Status",
      value: overview.occupancyStatus,
      helper: overview.occupancyHelper,
      icon: "status",
      accent: statusAccent
    }
  ];

  return (
    <div className={["pg-pfin-metrics", compact ? "pg-pfin-metrics--compact" : ""].filter(Boolean).join(" ")}>
      {cards.map((c) => (
        <div key={c.key} className="pg-pfin-metric-card">
          <IconContainer icon={c.icon} accent={c.accent} size={compact ? "md" : "lg"} />
          <div className="pg-pfin-metric-card__copy">
            <div className="pg-pfin-metric-card__label">{c.label}</div>
            <div
              className="pg-pfin-metric-card__value"
              style={c.key === "cashflow" ? { color: `var(--${cashAccent})` } : undefined}
            >
              {c.value}
            </div>
            <div className="pg-pfin-metric-card__helper">{c.helper}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
