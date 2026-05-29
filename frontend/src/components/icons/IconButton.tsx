import type { MouseEvent, ReactNode, ButtonHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "./AppIcon";
import type { IconName } from "./iconRegistry";
import type { IconSize } from "./iconSizes";

export type IconButtonVariant = "ghost" | "outline" | "primary" | "danger" | "danger-outline" | "subtle";

export type IconButtonProps = {
  icon: IconName;
  /** Required for icon-only controls (accessibility). */
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconSize;
  /** Hover tooltip; defaults to aria-label when true or omitted. */
  tooltip?: string | boolean;
  disabled?: boolean;
  href?: string;
  className?: string;
  onClick?: (e: MouseEvent) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "onClick">;

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost: "pg-icon-btn--ghost",
  outline: "pg-icon-btn--outline",
  primary: "pg-icon-btn--primary",
  danger: "pg-icon-btn--danger",
  "danger-outline": "pg-icon-btn--danger-outline",
  subtle: "pg-icon-btn--subtle"
};

/**
 * Icon-only button / link with optional hover tooltip.
 * Minimum tap target 44px (md). Colour via theme tokens.
 */
export function IconButton({
  icon,
  "aria-label": ariaLabel,
  variant = "outline",
  size = "sm",
  tooltip = true,
  disabled,
  href,
  className,
  onClick,
  type = "button",
  ...rest
}: IconButtonProps) {
  const btnClass = ["pg-icon-btn", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  const tooltipText = tooltip === false ? undefined : typeof tooltip === "string" ? tooltip : ariaLabel;
  const isExternalHref = href != null && /^(https?:|mailto:|tel:)/.test(href);

  const control = href ? (
    isExternalHref ? (
      <a
        className={btnClass}
        href={disabled ? undefined : href}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        <AppIcon name={icon} size={size} />
      </a>
    ) : (
      <Link
        className={btnClass}
        to={href}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        <AppIcon name={icon} size={size} />
      </Link>
    )
  ) : (
    <button
      type={type}
      className={btnClass}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      <AppIcon name={icon} size={size} />
    </button>
  );

  if (!tooltipText) return control;

  return (
    <span className="pg-icon-action-wrap">
      {control}
      <span className="pg-icon-action-tooltip" role="tooltip">
        {tooltipText}
      </span>
    </span>
  );
}

/** @deprecated Use IconButton — kept for statement row actions migrated earlier. */
export function IconActionButton({
  label,
  icon,
  disabled,
  variant = "default",
  href,
  onClick
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  href?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const mappedVariant: IconButtonVariant =
    variant === "primary" ? "primary" : variant === "danger" ? "danger" : "outline";
  return (
    <span className="pg-icon-action-wrap">
      {href ? (
        <Link
          className={["pg-icon-btn", VARIANT_CLASS[mappedVariant]].join(" ")}
          to={href}
          aria-label={label}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : undefined}
          onClick={(e) => {
            if (disabled) {
              e.preventDefault();
              return;
            }
            onClick?.(e);
          }}
        >
          {icon}
        </Link>
      ) : (
        <button
          type="button"
          className={["pg-icon-btn", VARIANT_CLASS[mappedVariant]].join(" ")}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </button>
      )}
      <span className="pg-icon-action-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
