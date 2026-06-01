/**
 * Proplytic house mark — refined vector (Figma node 3312:5).
 * @see https://www.figma.com/design/aJPG4JhiiegeXSUxskJwT8/Tiaan-De-Lange-s-team-library?node-id=3312-5
 */

export const PROPLYTIC_PURPLE = {
  start: "#6C4CFF",
  mid: "#8268F0",
  end: "#A78BFA",
  /** Solid fallback (favicon / tiny sizes) */
  mark: "#7B5BE4"
} as const;

export const PROPLYTIC_TEXT_LIGHT = "#111827";

export const PROPLYTIC_MARK_VIEWBOX = "0 0 100 100";

/**
 * Even-odd shell: outer house with bottom-left step + inner cavity.
 * Inner notch at bottom-left creates the characteristic “L” in the frame.
 */
export const PROPLYTIC_HOUSE_SHELL_PATH =
  "M50 6 10.5 38 10.5 66 18 66 18 85.5 10.5 85.5 10.5 89.25Q10.5 91.75 13 91.75H87Q89.5 91.75 89.5 89.25V38Z" +
  "M50 20.5 27 41.5 27 74.5 32.5 74.5 32.5 82.5 27 82.5V85.75H78V41.5Z";

/** Window panes + growth bars (100×100 space). */
export const PROPLYTIC_MARK_DETAIL_RECTS = [
  { x: 28.5, y: 43.5, w: 5, h: 5, rx: 0.75 },
  { x: 34.75, y: 43.5, w: 5, h: 5, rx: 0.75 },
  { x: 28.5, y: 50, w: 5, h: 5, rx: 0.75 },
  { x: 34.75, y: 50, w: 5, h: 5, rx: 0.75 },
  { x: 56, y: 73.5, w: 7.25, h: 12.25, rx: 3.625 },
  { x: 64.5, y: 67.25, w: 7.25, h: 18.5, rx: 3.625 },
  { x: 73, y: 59.75, w: 7.25, h: 26, rx: 3.625 }
] as const;

export function proplyticMarkGradientDef(id: string) {
  return (
    <linearGradient id={id} x1="14" y1="88" x2="86" y2="14" gradientUnits="userSpaceOnUse">
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
