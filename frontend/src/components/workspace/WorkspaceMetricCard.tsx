import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconContainer, type IconContainerAccent, type IconName } from "../icons";

export function WorkspaceMetricCard({
  label,
  value,
  helper,
  icon,
  accent = "primary",
  to,
  compact,
  valueStyle
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: IconName;
  accent?: IconContainerAccent;
  to?: string;
  compact?: boolean;
  valueStyle?: CSSProperties;
}) {
  const body = (
    <>
      <IconContainer icon={icon} accent={accent} size={compact ? "md" : "lg"} />
      <div className="pg-pfin-metric-card__copy">
        <div className="pg-pfin-metric-card__label">{label}</div>
        <div className="pg-pfin-metric-card__value" style={valueStyle}>
          {value}
        </div>
        {helper ? <div className="pg-pfin-metric-card__helper">{helper}</div> : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="pg-pfin-metric-card pg-pfin-metric-card--link">
        {body}
      </Link>
    );
  }

  return <div className="pg-pfin-metric-card">{body}</div>;
}

export function WorkspaceMetricsRow({
  children,
  compact,
  className,
  columns
}: {
  children: ReactNode;
  compact?: boolean;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={[
        "pg-pfin-metrics",
        compact ? "pg-pfin-metrics--compact" : "",
        columns === 3 ? "pg-pfin-metrics--3" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
