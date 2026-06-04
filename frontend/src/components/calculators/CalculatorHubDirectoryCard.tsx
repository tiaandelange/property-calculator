import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { CalculatorHubDirectoryItem } from "../../data/calculatorHubDirectory";
import { CalculatorIconDisplay } from "../icons/CalculatorIconDisplay";

type CalculatorHubDirectoryCardProps = {
  item: CalculatorHubDirectoryItem;
};

export function CalculatorHubDirectoryCard({ item }: CalculatorHubDirectoryCardProps) {
  if (item.kind === "tool") {
    return (
      <Link to={`/calculators/${item.slug}`} className="pg-calc-hub-dir-card">
        <CalculatorIconDisplay slug={item.slug} size="md" className="pg-calc-hub-dir-card__icon" />
        <div className="pg-calc-hub-dir-card__body">
          <h3 className="pg-calc-hub-dir-card__title">{item.name}</h3>
          <p className="pg-calc-hub-dir-card__desc">{item.description}</p>
          <span className="pg-calc-hub-dir-card__cta pg-calc-hub-dir-card__cta--desktop">
            Calculate <span aria-hidden>→</span>
          </span>
        </div>
        <ChevronRight className="pg-calc-hub-dir-card__arrow" size={22} strokeWidth={2.25} aria-hidden />
      </Link>
    );
  }

  return (
    <div className="pg-calc-hub-dir-card pg-calc-hub-dir-card--soon" aria-disabled="true">
      <CalculatorIconDisplay slug="monthly-payment" size="md" className="pg-calc-hub-dir-card__icon pg-calc-hub-dir-card__icon--muted" />
      <div className="pg-calc-hub-dir-card__body">
        <h3 className="pg-calc-hub-dir-card__title">{item.name}</h3>
        <p className="pg-calc-hub-dir-card__desc">{item.description}</p>
        <span className="pg-calc-hub-dir-card__cta pg-calc-hub-dir-card__cta--muted">Coming soon</span>
      </div>
    </div>
  );
}
