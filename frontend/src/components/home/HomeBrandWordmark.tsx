import { ProplyticLogo } from "../brand/ProplyticLogo";

/** Marketing / public site wordmark — raster lockup from public/. */
export function HomeBrandWordmark({
  alt,
  variant = "default"
}: {
  alt: string;
  variant?: "default" | "on-dark";
}) {
  const label = alt.trim() || "Proplytic";
  return (
    <ProplyticLogo mode="full" title={label} aria-label={label} wordmarkVariant={variant} />
  );
}
