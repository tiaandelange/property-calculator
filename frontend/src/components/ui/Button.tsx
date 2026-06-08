import React from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../icons/AppIcon";
import type { IconName } from "../icons/iconRegistry";
import type { IconSize } from "../icons/iconSizes";
import { isInternalAppPath } from "../../lib/routerLinks";
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
  href,
  onClick,
  target,
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
  const classes = buttonClassName({ variant, size, fullWidth, className });
  const content = (
    <>
      {iconLeft ? (
        <AppIcon name={iconLeft} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
      ) : null}
      {children ? <span className="pg-btn__label">{children}</span> : null}
      {iconRight ? (
        <AppIcon name={iconRight} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
      ) : null}
    </>
  );

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  if (href && isInternalAppPath(href) && !target) {
    return (
      <Link
        to={href}
        className={classes}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={handleClick}
        {...(props as Omit<React.ComponentProps<typeof Link>, "to" | "className" | "onClick">)}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={target}
      className={classes}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={handleClick}
      {...props}
    >
      {content}
    </a>
  );
}
