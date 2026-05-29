import type { SVGProps } from "react";
import { ProplyticHouseMark, proplyticGradientDef } from "./proplyticLogoShared";

export type ProplyticLogoIconProps = SVGProps<SVGSVGElement> & {
  /** Unique gradient id when multiple icons render on one page. */
  gradientId?: string;
};

/** House icon only — purple gradient outline with window + growth bars. */
export function ProplyticLogoIcon({
  gradientId = "proplytic-logo-gradient",
  width = 32,
  height = 32,
  viewBox = "0 0 48 48",
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
      <defs>{proplyticGradientDef(gradientId)}</defs>
      <ProplyticHouseMark gradientId={gradientId} />
    </svg>
  );
}
