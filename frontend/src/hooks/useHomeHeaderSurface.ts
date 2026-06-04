import { useEffect, useRef, useState } from "react";

export type HomeHeaderSurface = "hero" | "light";

const HERO_BOTTOM_BUFFER = 28;
const LIGHT_TOP_OFFSET = 48;
const SCROLL_DELTA_THRESHOLD = 6;
const TOP_REVEAL_SCROLL_Y = 20;

function resolveHomepageSurface(): HomeHeaderSurface {
  const hero = document.querySelector<HTMLElement>(".hm-hero");
  const lightSection = document.querySelector<HTMLElement>(".hm-trust");

  if (!hero || !lightSection) {
    return window.scrollY > 80 ? "light" : "hero";
  }

  const headerH =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--home-site-header-h")) ||
    72;
  const heroBottom = hero.getBoundingClientRect().bottom;
  const lightTop = lightSection.getBoundingClientRect().top;

  if (heroBottom > headerH + HERO_BOTTOM_BUFFER) {
    return "hero";
  }
  if (lightTop <= headerH + LIGHT_TOP_OFFSET) {
    return "light";
  }
  return "light";
}

export type HomeHeaderScrollState = {
  surface: HomeHeaderSurface;
  revealed: boolean;
};

/**
 * Marketing header: glass/light theme by scroll position; hide on scroll down,
 * reveal slowly on scroll up. At the very top of the homepage, always visible.
 */
export function useHomeHeaderSurface(isMarketingHome: boolean): HomeHeaderScrollState {
  const [surface, setSurface] = useState<HomeHeaderSurface>(isMarketingHome ? "hero" : "light");
  const [revealed, setRevealed] = useState(true);
  const lastScrollY = useRef(0);
  const revealedRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    lastScrollY.current = window.scrollY;
    revealedRef.current = true;

    const update = () => {
      const scrollY = window.scrollY;
      const delta = scrollY - lastScrollY.current;

      const nextSurface = isMarketingHome ? resolveHomepageSurface() : "light";
      setSurface(nextSurface);

      let nextRevealed = revealedRef.current;
      if (scrollY <= TOP_REVEAL_SCROLL_Y) {
        nextRevealed = true;
      } else if (delta > SCROLL_DELTA_THRESHOLD) {
        nextRevealed = false;
      } else if (delta < -SCROLL_DELTA_THRESHOLD) {
        nextRevealed = true;
      }

      if (nextRevealed !== revealedRef.current) {
        revealedRef.current = nextRevealed;
        setRevealed(nextRevealed);
      }

      lastScrollY.current = scrollY;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isMarketingHome]);

  return { surface, revealed };
}
