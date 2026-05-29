import type { HTMLAttributes } from "react";
import { ProplyticLogoAppIcon } from "./ProplyticLogoAppIcon";
import { ProplyticLogoIcon } from "./ProplyticLogoIcon";
import { ProplyticLogoWordmark } from "./ProplyticLogoWordmark";

export type ProplyticLogoMode = "full" | "icon" | "compact" | "app";

export type ProplyticLogoProps = {
  mode?: ProplyticLogoMode;
  className?: string;
  width?: number | string;
  height?: number | string;
  title?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Reusable Proplytic brand logo.
 * - full: icon + wordmark
 * - compact: smaller wordmark (sidebar / mobile)
 * - icon: house mark only
 * - app: rounded app-icon tile
 */
export function ProplyticLogo({
  mode = "full",
  className,
  width,
  height,
  title = "Proplytic",
  ...rest
}: ProplyticLogoProps) {
  const wrapClass = ["proplytic-logo", className].filter(Boolean).join(" ");

  if (mode === "icon") {
    return (
      <span className={wrapClass} {...rest}>
        <ProplyticLogoIcon width={width ?? 32} height={height ?? 32} aria-label={title} />
      </span>
    );
  }

  if (mode === "app") {
    return (
      <span className={wrapClass} {...rest}>
        <ProplyticLogoAppIcon width={width ?? 64} height={height ?? 64} aria-label={title} />
      </span>
    );
  }

  const compact = mode === "compact";
  const iconSize =
    typeof width === "number"
      ? width
      : compact
        ? 28
        : 34;

  return (
    <span className={wrapClass} role="img" aria-label={title} {...rest}>
      <ProplyticLogoWordmark compact={compact} iconSize={iconSize} />
    </span>
  );
}

export { ProplyticLogoAppIcon, ProplyticLogoIcon, ProplyticLogoWordmark };
