import type { ImgHTMLAttributes } from "react";
import { PROPLYTIC_LOGO_ASSET } from "./proplyticLogoShared";

export type ProplyticLogoWordmarkProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** @deprecated Icon is bundled in the horizontal PNG */
  iconSize?: number;
  compact?: boolean;
};

/** Horizontal Proplytic logo (600×200 nobg PNG). */
export function ProplyticLogoWordmark({
  className,
  compact = false,
  iconSize: _iconSize,
  alt = "",
  ...props
}: ProplyticLogoWordmarkProps) {
  return (
    <img
      src={PROPLYTIC_LOGO_ASSET}
      alt={alt}
      decoding="async"
      className={[
        "proplytic-logo-img",
        compact ? "proplytic-logo-img--compact" : "proplytic-logo-img--full",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
