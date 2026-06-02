/**
 * Proplytic house mark — official Canva export (`proplytic-mark.svg`, 1500×1500).
 * Lightweight vector paths below are kept for favicon / tiny fallbacks only.
 */

export const PROPLYTIC_PURPLE = {
  start: "#6C4CFF",
  mid: "#8268F0",
  end: "#A78BFA",
  /** Solid fallback (favicon / tiny sizes) */
  mark: "#7B5BE4"
} as const;

export const PROPLYTIC_TEXT_LIGHT = "#111827";

/** Official mark artboard (matches `proplytic-mark.svg`). */
export const PROPLYTIC_MARK_VIEWBOX = "0 0 1500 1500";

/** Public URL for the canonical SVG mark (Vite `public/`). */
export const PROPLYTIC_MARK_ASSET = "/assets/brand/proplytic-mark.svg";

/** Simplified vector artboard for favicon-only assets. */
export const PROPLYTIC_MARK_VECTOR_VIEWBOX = "0 0 500 500";

/**
 * Even-odd shell: outer house with bottom-left step + inner cavity.
 */
export const PROPLYTIC_HOUSE_SHELL_PATH =
  "M250 30 52.5 190 52.5 330 90 330 90 427.5 52.5 427.5 52.5 446.25Q52.5 458.75 65 458.75H435Q447.5 458.75 447.5 446.25V190Z" +
  "M250 102.5 135 207.5 135 372.5 162.5 372.5 162.5 412.5 135 412.5V428.75H390V207.5Z";

/** Window panes + growth bars (500×500 space). */
export const PROPLYTIC_MARK_DETAIL_RECTS = [
  { x: 142.5, y: 217.5, w: 25, h: 25, rx: 3.75 },
  { x: 173.75, y: 217.5, w: 25, h: 25, rx: 3.75 },
  { x: 142.5, y: 250, w: 25, h: 25, rx: 3.75 },
  { x: 173.75, y: 250, w: 25, h: 25, rx: 3.75 },
  { x: 280, y: 367.5, w: 36.25, h: 61.25, rx: 18.125 },
  { x: 322.5, y: 336.25, w: 36.25, h: 92.5, rx: 18.125 },
  { x: 365, y: 298.75, w: 36.25, h: 130, rx: 18.125 }
] as const;

export function proplyticMarkGradientDef(id: string) {
  return (
    <linearGradient id={id} x1="250" y1="32" x2="250" y2="468" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={PROPLYTIC_PURPLE.start} />
      <stop offset="55%" stopColor={PROPLYTIC_PURPLE.mid} />
      <stop offset="100%" stopColor={PROPLYTIC_PURPLE.end} />
    </linearGradient>
  );
}

/** @deprecated Use proplyticMarkGradientDef */
export function proplyticGradientDef(id: string) {
  return proplyticMarkGradientDef(id);
}

export function ProplyticHouseMark({
  fill,
  gradientId = "proplytic-mark-fill"
}: {
  fill?: string;
  gradientId?: string;
}) {
  const paint = fill ?? `url(#${gradientId})`;

  return (
    <>
      <path fill={paint} fillRule="evenodd" d={PROPLYTIC_HOUSE_SHELL_PATH} />
      {PROPLYTIC_MARK_DETAIL_RECTS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill={paint} />
      ))}
    </>
  );
}

export function proplyticMarkSvgFragment(opts?: { fill?: string; gradientId?: string }): string {
  const fill = opts?.fill ?? PROPLYTIC_PURPLE.mark;
  const rects = PROPLYTIC_MARK_DETAIL_RECTS.map(
    (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.rx}" fill="${fill}"/>`
  ).join("");
  return `<path fill="${fill}" fill-rule="evenodd" d="${PROPLYTIC_HOUSE_SHELL_PATH}"/>${rects}`;
}
