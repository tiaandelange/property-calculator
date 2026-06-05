import { AppIcon } from "../../../icons/AppIcon";
import type { HOME_HERO_FLOATING_ICONS } from "./homeHeroDemoData";

type FloatingIcon = (typeof HOME_HERO_FLOATING_ICONS)[number];

export function HomeHeroFloatingIconTile({ tile }: { tile: FloatingIcon }) {
  return (
    <span
      className={`hm-hero-float-icon hm-hero-float-icon--${tile.placement}${tile.faded ? " hm-hero-float-icon--faded" : ""}`}
      style={{ animationDelay: `${tile.delay}s` }}
    >
      <AppIcon name={tile.icon} size="sm" />
    </span>
  );
}
