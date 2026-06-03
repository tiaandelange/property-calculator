import type { ImgHTMLAttributes } from "react";
import { PROPLYTIC_ICON_ASSET } from "./proplyticLogoShared";

export type ProplyticLogoAppIconProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** @deprecated Ignored — official mark is a fixed PNG */
  gradientId?: string;
  /** @deprecated Ignored */
  viewBox?: string;
};

/** Rounded app-icon tile with the official square mark. */
export function ProplyticLogoAppIcon({
  gradientId: _gradientId,
  viewBox: _viewBox,
  width = 64,
  height = 64,
  alt = "Proplytic",
  className,
  role = "img",
  ...props
}: ProplyticLogoAppIconProps) {
  return (
    <img
      src={PROPLYTIC_ICON_ASSET}
      width={width}
      height={height}
      alt={alt}
      role={role}
      decoding="async"
      className={["proplytic-logo-img", "proplytic-logo-img--app", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
