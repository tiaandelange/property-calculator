/**
 * Official Proplytic brand assets (Vite `public/`).
 *
 * - Horizontal lockup: desktop, dashboard expanded, marketing header/footer
 * - Square mark: favicon, collapsed sidebar, mobile chrome, tight spaces
 */

export const PROPLYTIC_LOGO_ASSET = "/proplytic_logo_300x100.png";

/** 300×100 horizontal lockup intrinsic aspect ratio */
export const PROPLYTIC_LOGO_ASPECT = 3;

export const PROPLYTIC_ICON_ASSET = "/proplytic_icon_500x500.png";

/** @deprecated Use {@link PROPLYTIC_ICON_ASSET} */
export const PROPLYTIC_MARK_ASSET = PROPLYTIC_ICON_ASSET;

export const PROPLYTIC_MARK_VIEWBOX = "0 0 1000 1000";

/** Legacy SVG export (PDF fallback only). */
export const PROPLYTIC_MARK_SVG_ASSET = "/assets/brand/proplytic-mark.svg";

export const PROPLYTIC_PURPLE = {
  start: "#6C4CFF",
  mid: "#8268F0",
  end: "#A78BFA",
  mark: "#7B5BE4"
} as const;
