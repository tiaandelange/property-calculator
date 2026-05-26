import { BadgeCheck, DollarSign, Home, Images } from "lucide-react";
import { IconContainer } from "../../../components/ui/IconContainer";
import {
  INVESTMENT_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_HELPERS,
  type PropertyFormValues
} from "./propertyFormConstants";

function formatRent(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `R ${Math.round(n).toLocaleString()} /mo`;
}

export function PropertyMetricCards({
  form,
  mediaCount,
  compact
}: {
  form: PropertyFormValues;
  mediaCount: number;
  compact?: boolean;
}) {
  const investmentType = String(form.investmentType ?? "LONG_TERM_RENTAL");
  const propertyType = String(form.propertyType ?? "OTHER");
  const status = String(form.status ?? "").trim();
  const statusLabel = status || "Draft";
  const statusHelper = STATUS_HELPERS[status] ?? STATUS_HELPERS[status.toUpperCase()] ?? "Set listing status";

  const cards = [
    {
      key: "type",
      label: "Property Type",
      value: INVESTMENT_TYPE_LABELS[investmentType] ?? investmentType,
      helper: PROPERTY_TYPE_LABELS[propertyType] ?? "Property category",
      icon: Home,
      accent: "primary" as const
    },
    {
      key: "status",
      label: "Listing Status",
      value: statusLabel.replace(/_/g, " "),
      helper: statusHelper,
      icon: BadgeCheck,
      accent: "success" as const
    },
    {
      key: "rent",
      label: "Expected Rent",
      value: formatRent(form.expectedMonthlyIncome),
      helper: form.expectedMonthlyIncome ? "Monthly rent baseline" : "Market estimate",
      icon: DollarSign,
      accent: "success" as const
    },
    {
      key: "media",
      label: "Media Uploads",
      value: `${mediaCount} / 5`,
      helper: "Upload property photos",
      icon: Images,
      accent: "warning" as const
    }
  ];

  return (
    <div className={["pg-prop-metrics", compact ? "pg-prop-metrics--compact" : ""].filter(Boolean).join(" ")}>
      {cards.map((c) => (
        <div key={c.key} className="pg-prop-metric-card">
          <IconContainer icon={c.icon} accent={c.accent} size={compact ? "md" : "lg"} className="pg-prop-metric-card__icon" />
          <div className="pg-prop-metric-card__copy">
            <div className="pg-prop-metric-card__label">{c.label}</div>
            <div className="pg-prop-metric-card__value">{c.value}</div>
            <div className="pg-prop-metric-card__helper">{c.helper}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
