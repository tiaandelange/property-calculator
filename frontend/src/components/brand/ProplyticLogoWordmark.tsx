import { useEffect, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { PROPLYTIC_LOGO_ASSET, PROPLYTIC_LOGO_ASSET_ON_DARK } from "./proplyticLogoShared";

export type ProplyticLogoWordmarkProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** @deprecated Icon is bundled in the horizontal PNG */
  iconSize?: number;
  compact?: boolean;
  /** `on-dark` = light/contrast wordmark over dark hero header (falls back to default asset until uploaded) */
  variant?: "default" | "on-dark";
};

/** Horizontal Proplytic logo (600×200 nobg PNG). */
export function ProplyticLogoWordmark({
  className,
  compact = false,
  iconSize: _iconSize,
  variant = "default",
  alt = "",
  ...props
}: ProplyticLogoWordmarkProps) {
  const preferredSrc = variant === "on-dark" ? PROPLYTIC_LOGO_ASSET_ON_DARK : PROPLYTIC_LOGO_ASSET;
  const [src, setSrc] = useState(preferredSrc);

  useEffect(() => {
    setSrc(preferredSrc);
  }, [preferredSrc]);

  return (
    <img
      src={src}
      onError={() => {
        if (src !== PROPLYTIC_LOGO_ASSET) setSrc(PROPLYTIC_LOGO_ASSET);
      }}
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
