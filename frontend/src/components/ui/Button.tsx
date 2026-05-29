import React from "react";
import { AppIcon } from "../icons/AppIcon";
import type { IconName } from "../icons/iconRegistry";
import type { IconSize } from "../icons/iconSizes";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyles";

export type { ButtonSize, ButtonVariant };

const ICON_SIZE: Record<ButtonSize, IconSize> = {
  xs: "xs",
  sm: "sm",
  md: "sm",
  lg: "sm",
  xl: "md"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  iconLeft,
  iconRight,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
}) {
  const iconSize = ICON_SIZE[size];
  const isDisabled = disabled || loading;

  return (
    <button
      className={buttonClassName({ variant, size, fullWidth, loading, className })}
      {...props}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="pg-spinner" aria-hidden="true" /> : null}
      {!loading && iconLeft ? (
        <AppIcon name={iconLeft} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
      ) : null}
      {children ? <span className="pg-btn__label">{children}</span> : null}
      {!loading && iconRight ? (
        <AppIcon name={iconRight} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  iconLeft,
  iconRight,
  className,
  disabled,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
}) {
  const iconSize = ICON_SIZE[size];

  return (
    <a
      className={buttonClassName({ variant, size, fullWidth, className })}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      {...props}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        props.onClick?.(e);
      }}
    >
      {iconLeft ? (
        <AppIcon name={iconLeft} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
      ) : null}
      {children ? <span className="pg-btn__label">{children}</span> : null}
      {iconRight ? (
        <AppIcon name={iconRight} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
      ) : null}
    </a>
  );
}
