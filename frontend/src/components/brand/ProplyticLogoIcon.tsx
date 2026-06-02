import type { ImgHTMLAttributes } from "react";
import { PROPLYTIC_MARK_ASSET } from "./proplyticLogoShared";

export type ProplyticLogoIconProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** @deprecated Official mark is a fixed gradient SVG; ignored when using the asset. */
  gradientId?: string;
};

/** House mark from the official brand PNG. */
export function ProplyticLogoIcon({
  gradientId: _gradientId,
  width = 32,
  height = 32,
  alt = "Proplytic",
  ...props
}: ProplyticLogoIconProps) {
  return (
    <img
      src={PROPLYTIC_MARK_ASSET}
      width={width}
      height={height}
      alt={alt}
      decoding="async"
      {...props}
    />
  );
}
