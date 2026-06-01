import type { SVGProps } from "react";
import { PROPLYTIC_MARK_VIEWBOX, ProplyticHouseMark, proplyticMarkGradientDef } from "./proplyticLogoShared";

export type ProplyticLogoIconProps = SVGProps<SVGSVGElement> & {
  gradientId?: string;
};

/** House mark — gradient fill, window grid, growth bars. */
export function ProplyticLogoIcon({
  gradientId = "proplytic-logo-icon-fill",
  width = 32,
  height = 32,
  viewBox = PROPLYTIC_MARK_VIEWBOX,
  role = "img",
  "aria-label": ariaLabel = "Proplytic",
  ...props
}: ProplyticLogoIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role={role}
      aria-label={ariaLabel}
      {...props}
    >
      <defs>{proplyticMarkGradientDef(gradientId)}</defs>
      <ProplyticHouseMark gradientId={gradientId} />
    </svg>
  );
}
