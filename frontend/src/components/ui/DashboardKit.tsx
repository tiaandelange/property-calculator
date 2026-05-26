import type React from "react";
import {
  getDashboardStatIconConfig,
  inferDashboardStatIconPreset,
  type DashboardStatIconPreset
} from "../../icons/dashboardStatIcons";
import { IconBox, IconContainer, type IconContainerAccent } from "./IconContainer";

export type StatusTone = "default" | "success" | "warning" | "danger" | "accent" | "info" | "primary";

function statusClass(tone: StatusTone): string {
  if (tone === "primary") return "pg-status-primary";
  if (tone === "accent") return "pg-status-accent";
  if (tone === "info") return "pg-status-info";
  return `pg-status-${tone}`;
}

function iconToneForStat(
  tone: "default" | "accent" | "primary" | "success" | "danger" | "warning" | "info"
): IconContainerAccent {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "danger") return "danger";
  if (tone === "info") return "info";
  if (tone === "accent" || tone === "primary") return "primary";
  return "neutral";
}

function resolvePreset(
  title: string,
  iconPreset?: DashboardStatIconPreset | "auto"
): DashboardStatIconPreset | undefined {
  if (!iconPreset || iconPreset === "auto") return inferDashboardStatIconPreset(title);
  return iconPreset;
}

function StatCardIcon({
  title,
  icon,
  iconPreset,
  iconTone,
  tone
}: {
  title: string;
  icon?: React.ReactNode;
  iconPreset?: DashboardStatIconPreset | "auto";
  iconTone?: IconContainerAccent;
  tone: "default" | "accent" | "primary" | "success" | "danger" | "warning" | "info";
}): React.ReactNode {
  if (icon) {
    return (
      <IconBox tone={iconTone ?? iconToneForStat(tone)} size="md">
        {icon}
      </IconBox>
    );
  }
  if (iconPreset === undefined) return null;
  const preset = resolvePreset(title, iconPreset);
  if (!preset) return null;
  const { icon: Icon, accent } = getDashboardStatIconConfig(preset);
  return <IconContainer icon={Icon} accent={iconTone ?? accent} size="md" />;
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="pg-page-shell">{children}</div>;
}

export function StatCard({
  title,
  value,
  hint,
  tone = "default",
  icon,
  iconPreset,
  iconTone,
  onClick,
  ariaLabel,
  elevated
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "primary" | "success" | "danger" | "warning" | "info";
  icon?: React.ReactNode;
  /** Lucide preset; `"auto"` infers from title. Omit to hide icons unless `icon` is passed. */
  iconPreset?: DashboardStatIconPreset | "auto";
  iconTone?: IconContainerAccent;
  onClick?: () => void;
  ariaLabel?: string;
  elevated?: boolean;
}) {
  const clickable = Boolean(onClick);
  const statTone =
    tone === "accent" ? "accent" : tone === "primary" ? "primary" : tone === "info" ? "info" : tone;
  const iconEl = (
    <StatCardIcon title={title} icon={icon} iconPreset={iconPreset} iconTone={iconTone} tone={tone} />
  );
  const showIcon = iconEl != null;

  return (
    <div
      className={[
        "pg-workspace-card",
        "pg-stat-card",
        `pg-stat-${statTone}`,
        elevated ? "pg-stat-card--elevated" : "",
        clickable ? "pg-stat-card--clickable" : "",
        iconEl ? "pg-stat-card--with-icon" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {iconEl ? (
        <div className="pg-stat-card-layout">
          {iconEl}
          <div className="pg-stat-card-main">
            <div className="pg-stat-title">{title}</div>
            <div className="pg-stat-value">{value}</div>
            {hint ? <div className="pg-stat-hint">{hint}</div> : null}
            {clickable ? <div className="pg-stat-hint pg-stat-card-cta-hint">View details</div> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="pg-stat-title">{title}</div>
          <div className="pg-stat-value">{value}</div>
          {hint ? <div className="pg-stat-hint">{hint}</div> : null}
          {clickable ? <div className="pg-stat-hint pg-stat-card-cta-hint">View details</div> : null}
        </>
      )}
    </div>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  iconPreset,
  iconTone,
  onClick,
  ariaLabel,
  elevated
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  iconPreset?: DashboardStatIconPreset | "auto";
  iconTone?: IconContainerAccent;
  onClick?: () => void;
  ariaLabel?: string;
  elevated?: boolean;
}) {
  const clickable = Boolean(onClick);
  const iconEl = (
    <StatCardIcon
      title={title}
      icon={icon}
      iconPreset={iconPreset}
      iconTone={iconTone ?? "primary"}
      tone="default"
    />
  );
  const showIcon = iconEl != null;

  return (
    <div
      className={[
        "pg-workspace-card",
        "pg-metric-card",
        elevated ? "pg-metric-card--elevated" : "",
        clickable ? "pg-metric-card--clickable" : "",
        iconEl ? "pg-metric-card--with-icon" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {iconEl ? (
        <div className="pg-stat-card-layout">
          {iconEl}
          <div className="pg-stat-card-main">
            <div className="pg-stat-title">{title}</div>
            <div className="pg-metric-value">{value}</div>
            {subtitle ? <div className="pg-stat-hint">{subtitle}</div> : null}
            {clickable ? <div className="pg-stat-hint pg-stat-card-cta-hint">View details</div> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="pg-stat-title">{title}</div>
          <div className="pg-metric-value">{value}</div>
          {subtitle ? <div className="pg-stat-hint">{subtitle}</div> : null}
          {clickable ? <div className="pg-stat-hint pg-stat-card-cta-hint">View details</div> : null}
        </>
      )}
    </div>
  );
}

export function DashboardCard({
  title,
  actions,
  children,
  elevated
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  elevated?: boolean;
}) {
  return (
    <div
      className={["pg-workspace-card", "pg-dashboard-card", elevated ? "pg-dashboard-card--elevated" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pg-dashboard-card-header">
        <h3>{title}</h3>
        {actions}
      </div>
      <div className="pg-dashboard-card-body">{children}</div>
    </div>
  );
}

export function StatusPill({
  label,
  tone = "default"
}: {
  label: string;
  tone?: StatusTone;
}) {
  return <span className={`pg-status-pill ${statusClass(tone)}`}>{label}</span>;
}

/** Alias for StatusPill — soft-filled semantic badge. */
export const Badge = StatusPill;

export function EmptyState({
  title,
  body,
  actions,
  iconPreset
}: {
  title: string;
  body: string;
  actions?: React.ReactNode;
  iconPreset?: DashboardStatIconPreset;
}) {
  const iconConfig = iconPreset ? getDashboardStatIconConfig(iconPreset) : null;
  return (
    <div className="pg-empty-state">
      {iconConfig ? (
        <div className="pg-empty-state-icon">
          <IconContainer icon={iconConfig.icon} accent={iconConfig.accent} size="lg" />
        </div>
      ) : null}
      <h2>{title}</h2>
      <p>{body}</p>
      {actions ? <div className="pg-empty-actions">{actions}</div> : null}
    </div>
  );
}

export function AlertBanner({
  tone = "default",
  title,
  message,
  action
}: {
  tone?: StatusTone;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`pg-alert-banner ${statusClass(tone)}`}>
      <div>
        <strong>{title}</strong>
        <div className="pg-muted">{message}</div>
      </div>
      {action}
    </div>
  );
}

export { LoadingState, SkeletonGrid } from "./LoadingState";
export type { DashboardStatIconPreset } from "../../icons/dashboardStatIcons";
