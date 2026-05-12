import { HomeHeroImage } from "./HomeHeroImage";
import { HomeHeroValueOverlay } from "./HomeHeroValueOverlay";

/**
 * Hero right column: full-bleed property image with stacked gradient fades (no card chrome).
 */
export function HomeHeroVisual() {
  return (
    <div className="pg-home-hero-visual">
      <HomeHeroImage
        kind="property"
        alt="Modern luxury home at dusk — confident property decisions backed by calculators"
        className="pg-home-hero-visual-img"
        width={1920}
        height={1080}
        fetchPriority="high"
      />
      <div className="pg-home-hero-image-fade pg-home-hero-image-fade-left" aria-hidden="true" />
      <div className="pg-home-hero-image-fade pg-home-hero-image-fade-bottom" aria-hidden="true" />
      <div className="pg-home-hero-image-fade pg-home-hero-image-fade-top" aria-hidden="true" />
      <HomeHeroValueOverlay />
    </div>
  );
}
