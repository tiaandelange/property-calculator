/**
 * Official Proplytic brand assets (Vite `public/`).
 *
 * - Horizontal lockup (nobg): desktop, dashboard expanded, marketing header/footer
 * - Square mark (nobg): collapsed sidebar, mobile chrome, PWA icons, tight spaces
 * - Square mark (white bg): browser tab favicon only
 */

/** Horizontal wordmark — transparent background (light header / light pages) */
export const PROPLYTIC_LOGO_ASSET = "/proplytic_logo_600x200_nobg.png";

/** Horizontal wordmark for glass header on dark hero — upload `*_nobg_light.png` when ready */
export const PROPLYTIC_LOGO_ASSET_ON_DARK = "/proplytic_logo_600x200_nobg_light.png";

/** 600×200 horizontal lockup intrinsic aspect ratio */
export const PROPLYTIC_LOGO_ASPECT = 3;

/** Square mark — transparent background (UI, mobile, OG image) */
export const PROPLYTIC_ICON_ASSET = "/proplytic_icon_500x500_nobg.png";

/** Square mark — white background (browser favicon only) */
export const PROPLYTIC_FAVICON_ASSET = "/proplytic_icon_500x500.png";

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
