import { useEffect, useState } from "react";

export type HomeHeaderSurface = "hero" | "hidden" | "light";

const HERO_BOTTOM_BUFFER = 28;
const LIGHT_TOP_OFFSET = 48;

/**
 * Homepage header: glass over dark hero → hides while scrolling dark bands →
 * light bar when the first light section (.hm-trust) reaches the header zone.
 */
export function useHomeHeaderSurface(enabled: boolean): HomeHeaderSurface {
  const [surface, setSurface] = useState<HomeHeaderSurface>(enabled ? "hero" : "light");

  useEffect(() => {
    if (!enabled) {
      setSurface("light");
      return;
    }

    const resolve = () => {
      const hero = document.querySelector<HTMLElement>(".hm-hero");
      const lightSection = document.querySelector<HTMLElement>(".hm-trust");

      if (!hero || !lightSection) {
        setSurface(window.scrollY > 80 ? "light" : "hero");
        return;
      }

      const headerH =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--home-site-header-h")
        ) || 72;
      const heroBottom = hero.getBoundingClientRect().bottom;
      const lightTop = lightSection.getBoundingClientRect().top;

      if (heroBottom > headerH + HERO_BOTTOM_BUFFER) {
        setSurface("hero");
      } else if (lightTop <= headerH + LIGHT_TOP_OFFSET) {
        setSurface("light");
      } else {
        setSurface("hidden");
      }
    };

    resolve();
    window.addEventListener("scroll", resolve, { passive: true });
    window.addEventListener("resize", resolve);
    return () => {
      window.removeEventListener("scroll", resolve);
      window.removeEventListener("resize", resolve);
    };
  }, [enabled]);

  return surface;
}
