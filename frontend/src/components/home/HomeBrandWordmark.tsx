import { ProplyticLogo } from "../brand/ProplyticLogo";

/** Marketing / public site wordmark — SVG only (no raster fallback). */
export function HomeBrandWordmark({ alt }: { alt: string }) {
  const label = alt.trim() || "Proplytic";
  return <ProplyticLogo mode="full" title={label} aria-label={label} />;
}
