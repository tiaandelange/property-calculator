import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconContainer, type IconContainerAccent } from "../../components/ui/IconContainer";

export function PortfolioMetricCard({
  label,
  value,
  changeText,
  changeTone = "neutral",
  icon: Icon,
  iconAccent = "primary",
  highlighted,
  compact
}: {
  label: string;
  value: ReactNode;
  changeText?: string;
  changeTone?: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconAccent?: IconContainerAccent;
  highlighted?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "pg-pdash-metric",
        highlighted ? "pg-pdash-metric--highlight" : "",
        compact ? "pg-pdash-metric--compact" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
    </div>
  );
}
