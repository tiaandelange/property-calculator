/** Shared SVG defs and house mark paths for Proplytic brand assets. */

export const PROPLYTIC_PURPLE = {
  start: "#6C4CFF",
  mid: "#8B5CF6",
  end: "#A78BFA"
} as const;

export const PROPLYTIC_TEXT_LIGHT = "#111827";

export function proplyticGradientDef(id: string) {
  return (
    <linearGradient id={id} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={PROPLYTIC_PURPLE.start} />
      <stop offset="55%" stopColor={PROPLYTIC_PURPLE.mid} />
      <stop offset="100%" stopColor={PROPLYTIC_PURPLE.end} />
    </linearGradient>
  );
}

/** House outline with window grid + growth bars (viewBox 0 0 48 48). */
export function ProplyticHouseMark({ gradientId }: { gradientId: string }) {
  return (
    <>
      <path
        d="M11 22.5 24 11.5 37 22.5V39.5H11V22.5Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M11 39.5H37"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <rect x="14.5" y="26" width="3.2" height="3.2" rx="0.45" fill={`url(#${gradientId})`} />
      <rect x="18.3" y="26" width="3.2" height="3.2" rx="0.45" fill={`url(#${gradientId})`} />
      <rect x="14.5" y="29.8" width="3.2" height="3.2" rx="0.45" fill={`url(#${gradientId})`} />
      <rect x="18.3" y="29.8" width="3.2" height="3.2" rx="0.45" fill={`url(#${gradientId})`} />
      <rect x="27.5" y="31" width="3" height="5.5" rx="1" fill={`url(#${gradientId})`} />
      <rect x="31.5" y="28.5" width="3" height="8" rx="1" fill={`url(#${gradientId})`} />
      <rect x="35.5" y="26" width="3" height="10.5" rx="1" fill={`url(#${gradientId})`} />
    </>
  );
}
