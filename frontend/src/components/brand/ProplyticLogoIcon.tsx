import type { ImgHTMLAttributes } from "react";
import { PROPLYTIC_ICON_ASSET } from "./proplyticLogoShared";

export type ProplyticLogoIconProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** @deprecated Ignored — official mark is a fixed PNG */
  gradientId?: string;
};

/** Square Proplytic mark (500×500 PNG). */
export function ProplyticLogoIcon({
  gradientId: _gradientId,
  width = 32,
  height = 32,
  alt = "Proplytic",
  className,
  ...props
}: ProplyticLogoIconProps) {
  return (
    <img
      src={PROPLYTIC_ICON_ASSET}
      width={width}
      height={height}
      alt={alt}
      decoding="async"
      className={["proplytic-logo-img", "proplytic-logo-img--icon", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
