import type { SVGProps } from "react";
import { ProplyticHouseMark, proplyticGradientDef } from "./proplyticLogoShared";

export type ProplyticLogoAppIconProps = SVGProps<SVGSVGElement> & {
  gradientId?: string;
};

/** Rounded app-icon tile with centered house mark. */
export function ProplyticLogoAppIcon({
  gradientId = "proplytic-app-gradient",
  width = 64,
  height = 64,
  viewBox = "0 0 64 64",
  role = "img",
  "aria-label": ariaLabel = "Proplytic",
  ...props
}: ProplyticLogoAppIconProps) {
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
      <defs>
        {proplyticGradientDef(gradientId)}
        <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6C4CFF" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="var(--surface, #ffffff)" filter={`url(#${gradientId}-shadow)`} />
      <g transform="translate(8 8) scale(1)">
        <ProplyticHouseMark gradientId={gradientId} />
      </g>
    </svg>
  );
}
