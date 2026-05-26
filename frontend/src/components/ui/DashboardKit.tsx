import type React from "react";
import { IconBox, type IconContainerAccent } from "./IconContainer";

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

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="pg-page-shell">{children}</div>;
}

export function StatCard({
  title,
  value,
  hint,
  tone = "default",
  icon,
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
  iconTone?: IconContainerAccent;
  onClick?: () => void;
  ariaLabel?: string;
  elevated?: boolean;
}) {
  const clickable = Boolean(onClick);
  const statTone =
    tone === "accent" ? "accent" : tone === "primary" ? "primary" : tone === "info" ? "info" : tone;
  return (
    <div
      className={[
        "pg-stat-card",
        `pg-stat-${statTone}`,
        elevated ? "pg-stat-card--elevated" : "",
        clickable ? "pg-stat-card--clickable" : ""
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
      {icon ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <IconBox tone={iconTone ?? iconToneForStat(tone)} size="md">
            {icon}
          </IconBox>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pg-stat-title">{title}</div>
            <div className="pg-stat-value">{value}</div>
            {hint ? <div className="pg-stat-hint">{hint}</div> : null}
            {clickable ? <div className="pg-stat-hint" style={{ marginTop: 6 }}>View details</div> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="pg-stat-title">{title}</div>
          <div className="pg-stat-value">{value}</div>
          {hint ? <div className="pg-stat-hint">{hint}</div> : null}
          {clickable ? <div className="pg-stat-hint" style={{ marginTop: 6 }}>View details</div> : null}
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
  iconTone = "primary",
  onClick,
  ariaLabel,
  elevated
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  iconTone?: IconContainerAccent;
  onClick?: () => void;
  ariaLabel?: string;
  elevated?: boolean;
}) {
  const clickable = Boolean(onClick);
  return (
    <div
      className={[
        "pg-metric-card",
        elevated ? "pg-metric-card--elevated" : "",
        clickable ? "pg-metric-card--clickable" : ""
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
      {icon ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <IconBox tone={iconTone}>{icon}</IconBox>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pg-stat-title">{title}</div>
            <div className="pg-metric-value">{value}</div>
            {subtitle ? <div className="pg-stat-hint">{subtitle}</div> : null}
            {clickable ? <div className="pg-stat-hint" style={{ marginTop: 6 }}>View details</div> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="pg-stat-title">{title}</div>
          <div className="pg-metric-value">{value}</div>
          {subtitle ? <div className="pg-stat-hint">{subtitle}</div> : null}
          {clickable ? <div className="pg-stat-hint" style={{ marginTop: 6 }}>View details</div> : null}
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
    <div className={["pg-dashboard-card", elevated ? "pg-dashboard-card--elevated" : ""].filter(Boolean).join(" ")}>
      <div className="pg-dashboard-card-header">
        <h3>{title}</h3>
        {actions}
      </div>
      <div>{children}</div>
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

export function EmptyState({ title, body, actions }: { title: string; body: string; actions?: React.ReactNode }) {
  return (
    <div className="pg-empty-state">
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
