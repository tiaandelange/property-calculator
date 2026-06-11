import type React from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../icons/AppIcon";
import type { IconName } from "../icons/iconRegistry";
import { IconContainer, type IconContainerAccent } from "../icons/IconContainer";
import type { IconContainerSize } from "../icons/iconSizes";
import { Button, ButtonLink } from "./Button";
import { typographyClassName } from "./Typography";

export type AppCardVariant =
  | "default"
  | "elevated"
  | "muted"
  | "interactive"
  | "warning"
  | "danger"
  | "success"
  | "primary";

export type AppCardPadding = "none" | "sm" | "md" | "lg";

function cardClassName({
  variant = "default",
  padding = "md",
  className,
  interactive
}: {
  variant?: AppCardVariant;
  padding?: AppCardPadding;
  className?: string;
  interactive?: boolean;
}) {
  return [
    "pg-app-card",
    variant !== "default" ? `pg-app-card--${variant}` : "",
    padding !== "none" ? `pg-app-card--pad-${padding}` : "",
    interactive || variant === "interactive" ? "pg-app-card--interactive" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
}

export function AppCard({
  variant = "default",
  padding = "md",
  interactive,
  className,
  children,
  onClick,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  variant?: AppCardVariant;
  padding?: AppCardPadding;
  interactive?: boolean;
  as?: "div" | "section" | "article" | "button" | "a";
}) {
  const cls = cardClassName({ variant, padding, className, interactive });
  return (
    <Tag className={cls} onClick={onClick} {...props}>
      {children}
    </Tag>
  );
}

export function AppCardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={["pg-app-card-header", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppCardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={typographyClassName("cardTitle", ["pg-app-card-title", className].filter(Boolean).join(" "))}>{children}</h3>;
}

export function AppCardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={typographyClassName("cardDescription", ["pg-app-card-description", className].filter(Boolean).join(" "))}>{children}</p>;
}

export function AppCardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={["pg-app-card-content", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppCardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={["pg-app-card-footer", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppMetricCard({
  label,
  value,
  hint,
  icon,
  iconAccent = "primary",
  iconSize = "sm",
  variant = "elevated",
  to,
  onClick,
  ariaLabel,
  className
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: IconName;
  iconAccent?: IconContainerAccent;
  iconSize?: IconContainerSize;
  variant?: AppCardVariant;
  to?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  const inner = (
    <>
      {icon ? <IconContainer icon={icon} accent={iconAccent} size={iconSize} className="pg-app-metric-card-icon" /> : null}
      <div className="pg-app-metric-card-copy">
        <div className={typographyClassName("metricLabel", "pg-app-metric-card-label")}>{label}</div>
        <div className={typographyClassName("metricValue", "pg-app-metric-card-value")}>{value}</div>
        {hint ? <div className={typographyClassName("helper", "pg-app-metric-card-hint")}>{hint}</div> : null}
      </div>
    </>
  );

  const cls = ["pg-app-metric-card", cardClassName({ variant, padding: "md", interactive: Boolean(onClick || to) }), className]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} className={cls} aria-label={ariaLabel ?? label}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel ?? label}>
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}

export function AppInfoCard({
  title,
  description,
  icon,
  iconAccent = "info",
  variant = "muted",
  children,
  className
}: {
  title: string;
  description?: string;
  icon?: IconName;
  iconAccent?: IconContainerAccent;
  variant?: AppCardVariant;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <AppCard variant={variant} padding="md" className={["pg-app-info-card", className].filter(Boolean).join(" ")}>
      <AppCardHeader>
        {icon ? <IconContainer icon={icon} accent={iconAccent} size="sm" /> : null}
        <div>
          <AppCardTitle>{title}</AppCardTitle>
          {description ? <AppCardDescription>{description}</AppCardDescription> : null}
        </div>
      </AppCardHeader>
      {children ? <AppCardContent>{children}</AppCardContent> : null}
    </AppCard>
  );
}

export function AppActionCard({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon,
  variant = "interactive",
  className
}: {
  title: string;
  description?: string;
  actionLabel: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: IconName;
  variant?: AppCardVariant;
  className?: string;
}) {
  return (
    <AppCard variant={variant} padding="md" className={["pg-app-action-card", className].filter(Boolean).join(" ")}>
      <AppCardHeader>
        {icon ? <AppIcon name={icon} size="md" aria-hidden="true" /> : null}
        <div>
          <AppCardTitle>{title}</AppCardTitle>
          {description ? <AppCardDescription>{description}</AppCardDescription> : null}
        </div>
      </AppCardHeader>
      <AppCardFooter>
        {actionHref ? (
          <ButtonLink href={actionHref} variant="secondary" size="sm">
            {actionLabel}
          </ButtonLink>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </AppCardFooter>
    </AppCard>
  );
}

export function AppEmptyStateCard({
  title,
  description,
  icon = "document",
  actions,
  className
}: {
  title: string;
  description?: string;
  icon?: IconName;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <AppCard variant="muted" padding="lg" className={["pg-app-empty-state-card", className].filter(Boolean).join(" ")}>
      <div className="pg-app-empty-state-card-icon">
        <IconContainer icon={icon} accent="neutral" size="lg" />
      </div>
      <AppCardTitle>{title}</AppCardTitle>
      {description ? <AppCardDescription>{description}</AppCardDescription> : null}
      {actions ? <div className="pg-app-empty-state-card-actions">{actions}</div> : null}
    </AppCard>
  );
}
