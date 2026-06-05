import { IconContainerByName } from "../../icons";
import type { IconName } from "../../icons/iconRegistry";

export type CalculatorSummaryCard = {
  key: string;
  label: string;
  value: string;
  helper?: string;
  icon?: IconName;
};

const METRIC_ICONS: Record<string, IconName> = {
  monthlyPayment: "wallet",
  totalInterest: "percent",
  totalPaid: "income",
  interestSaved: "income",
  loanAmount: "calculators",
  bondAmount: "calculators",
  netCashFlow: "wallet",
  capRate: "percent",
  noi: "income",
  dscr: "calculators",
  irr: "calculators",
  default: "info"
};

function iconForKey(key: string): IconName {
  return METRIC_ICONS[key] ?? METRIC_ICONS.default;
}

export function CalculatorToolSummaryCards({ cards }: { cards: CalculatorSummaryCard[] }) {
  if (!cards.length) return null;

  return (
    <div className="pg-calc-tool-summary-cards pg-pfin-metrics" role="list">
      {cards.map((card) => (
        <article key={card.key} className="pg-pfin-metric-card pg-calc-tool-summary-card" role="listitem">
          <IconContainerByName icon={card.icon ?? iconForKey(card.key)} accent="purple" size="sm" />
          <div className="pg-calc-tool-summary-card__body">
            <div className="pg-pfin-metric-card__label-row">
              <span className="pg-pfin-metric-card__label">{card.label}</span>
            </div>
            <div className="pg-pfin-metric-card__value">{card.value}</div>
            {card.helper ? <div className="pg-pfin-metric-card__helper">{card.helper}</div> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
