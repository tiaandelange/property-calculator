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
  /** Wordmark asset for dark backgrounds (marketing hero header) */
  wordmarkVariant?: "default" | "on-dark";
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Reusable Proplytic brand logo.
 * - full / compact: horizontal lockup (`proplytic_logo_600x200_nobg.png`)
 * - icon / app: square mark (`proplytic_icon_500x500_nobg.png`)
 */
export function ProplyticLogo({
  mode = "full",
  className,
  width,
  height,
  title = "Proplytic",
  wordmarkVariant = "default",
  ...rest
}: ProplyticLogoProps) {
  const wrapClass = ["proplytic-logo", className].filter(Boolean).join(" ");

  if (mode === "icon") {
    return (
      <span className={wrapClass} {...rest}>
        <ProplyticLogoIcon width={width ?? 32} height={height ?? 32} aria-label={title} role="img" />
      </span>
    );
  }

  if (mode === "app") {
    return (
      <span className={wrapClass} {...rest}>
        <ProplyticLogoAppIcon width={width ?? 64} height={height ?? 64} aria-label={title} role="img" />
      </span>
    );
  }

  const compact = mode === "compact";
  const logoHeight =
    typeof height === "number" ? height : compact ? 28 : typeof width === "number" ? undefined : 36;

  return (
    <span className={wrapClass} role="img" aria-label={title} {...rest}>
      <ProplyticLogoWordmark
        compact={compact}
        variant={wordmarkVariant}
        alt=""
        aria-hidden
        height={logoHeight}
        width={typeof width === "number" ? width : undefined}
      />
    </span>
  );
}

export { ProplyticLogoAppIcon, ProplyticLogoIcon, ProplyticLogoWordmark };
