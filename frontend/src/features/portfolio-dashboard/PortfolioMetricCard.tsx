import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppMetricCard } from "../../components/ui/AppCard";
import { IconContainer, type IconContainerAccent, type IconName } from "../../components/icons";

export function PortfolioMetricCard({
  label,
  value,
  changeText,
  changeTone = "neutral",
  icon,
  iconAccent = "primary",
  highlighted,
  compact,
  to,
  ariaLabel
}: {
  label: string;
  value: ReactNode;
  changeText?: string;
  changeTone?: "up" | "down" | "neutral";
  icon: IconName;
  iconAccent?: IconContainerAccent;
  highlighted?: boolean;
  compact?: boolean;
  to?: string;
  ariaLabel?: string;
}) {
  const layoutClass = [
    "pg-workspace-card",
    "pg-pdash-metric",
    highlighted ? "pg-pdash-metric--highlight" : "",
    compact ? "pg-pdash-metric--compact" : "",
    to ? "pg-pdash-metric--link" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const card = (
    <AppMetricCard
      label={label}
      value={value}
      icon={icon}
      iconAccent={iconAccent}
      variant={highlighted ? "primary" : "elevated"}
      ariaLabel={ariaLabel}
      className={layoutClass}
    />
  );

  if (to) {
    return (
      <Link
        to={to}
        className={[
          "pg-app-card",
          highlighted ? "pg-app-card--primary" : "pg-app-card--elevated",
          "pg-app-card--pad-md",
          "pg-app-card--interactive",
          layoutClass
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={ariaLabel ?? label}
      >
        <div className="pg-pdash-metric-top">
          <div className="pg-pdash-metric-copy">
            <div className="pg-text-metric-label pg-pdash-metric-label">{label}</div>
            <div className="pg-text-metric-value pg-pdash-metric-value">{value}</div>
            {changeText ? (
              <div className={`pg-pdash-metric-change pg-pdash-metric-change--${changeTone}`}>{changeText}</div>
            ) : null}
          </div>
          <IconContainer icon={icon} accent={iconAccent} size="md" className="pg-pdash-metric-icon-wrap" />
        </div>
      </Link>
    );
  }

  if (changeText) {
    return (
      <div
        className={[
          "pg-app-card",
          highlighted ? "pg-app-card--primary" : "pg-app-card--elevated",
          "pg-app-card--pad-md",
          layoutClass
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="pg-app-metric-card">
          <IconContainer icon={icon} accent={iconAccent} size="md" className="pg-app-metric-card-icon" />
          <div className="pg-app-metric-card-copy">
            <div className="pg-text-metric-label pg-pdash-metric-label">{label}</div>
            <div className="pg-text-metric-value pg-pdash-metric-value">{value}</div>
            <div className={`pg-pdash-metric-change pg-pdash-metric-change--${changeTone}`}>{changeText}</div>
          </div>
        </div>
      </div>
    );
  }

  return card;
}
