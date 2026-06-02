import type { SVGProps } from "react";
import { PROPLYTIC_MARK_ASSET, PROPLYTIC_MARK_VIEWBOX } from "./proplyticLogoShared";

export type ProplyticLogoAppIconProps = SVGProps<SVGSVGElement> & {
  /** @deprecated Official mark is a fixed gradient SVG; ignored when using the asset. */
  gradientId?: string;
};

/** Rounded app-icon tile with centered official house mark. */
export function ProplyticLogoAppIcon({
  gradientId: _gradientId,
  width = 64,
  height = 64,
  viewBox = PROPLYTIC_MARK_VIEWBOX,
  role = "img",
  "aria-label": ariaLabel = "Proplytic",
  ...props
}: ProplyticLogoAppIconProps) {
  const inset = 220;

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
        <filter id="proplytic-app-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#6C4CFF" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect
        x="44"
        y="44"
        width="1412"
        height="1412"
        rx="300"
        fill="var(--surface, #ffffff)"
        filter="url(#proplytic-app-shadow)"
      />
      <image
        href={PROPLYTIC_MARK_ASSET}
        x={inset}
        y={inset}
        width={1500 - inset * 2}
        height={1500 - inset * 2}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
