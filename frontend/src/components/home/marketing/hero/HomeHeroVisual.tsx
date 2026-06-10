import { HomeHeroDashboardMockup } from "./HomeHeroDashboardMockup";
import { HomeHeroFloatingIconTile } from "./HomeHeroFloatingIconTile";
import { HomeHeroOrbitLines } from "./HomeHeroOrbitLines";
import { HOME_HERO_FLOATING_ICONS } from "./homeHeroDemoData";
import "./homeHeroDashboard.css";

/** Right-side cinematic dashboard visual for the public homepage hero. */
export function HomeHeroVisual() {
  return (
    <div className="hm-hero-visual hm-hero-visual--premium" aria-hidden>
      <div className="hm-hero-visual__glow" />
      <HomeHeroOrbitLines />

      <div className="hm-hero-visual__stage">
        {HOME_HERO_FLOATING_ICONS.map((tile) => (
          <HomeHeroFloatingIconTile key={tile.placement} tile={tile} />
        ))}

        <div className="hm-hero-visual__dash-wrap">
          <div className="hm-hero-visual__dash hm-hero-visual__dash--desktop">
            <HomeHeroDashboardMockup />
          </div>
          <div className="hm-hero-visual__dash hm-hero-visual__dash--mobile">
            <HomeHeroDashboardMockup compact />
          </div>
        </div>
      </div>
    </div>
  );
}
