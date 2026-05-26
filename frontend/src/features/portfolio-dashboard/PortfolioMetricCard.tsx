import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconContainer, type IconContainerAccent } from "../../components/ui/IconContainer";

export function PortfolioMetricCard({
  label,
  value,
  changeText,
  changeTone = "neutral",
  icon: Icon,
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
  icon: LucideIcon;
  iconAccent?: IconContainerAccent;
  highlighted?: boolean;
  compact?: boolean;
  to?: string;
  ariaLabel?: string;
}) {
  const className = [
    "pg-pdash-metric",
    highlighted ? "pg-pdash-metric--highlight" : "",
    compact ? "pg-pdash-metric--compact" : "",
    to ? "pg-pdash-metric--link" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <div className="pg-pdash-metric-top">
        <div className="pg-pdash-metric-copy">
          <div className="pg-pdash-metric-label">{label}</div>
          <div className="pg-pdash-metric-value">{value}</div>
          {changeText ? (
            <div className={`pg-pdash-metric-change pg-pdash-metric-change--${changeTone}`}>{changeText}</div>
          ) : null}
        </div>
        <IconContainer icon={Icon} accent={iconAccent} size="md" className="pg-pdash-metric-icon-wrap" />
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel ?? label}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
