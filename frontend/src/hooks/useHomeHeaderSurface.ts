import { useEffect, useRef, useState } from "react";

export type HomeHeaderSurface = "hero" | "light";

/** Which marketing page supplies the dark hero band for header glass treatment. */
export type MarketingHeroContext = "home" | "calculators-hub" | "reports-hub" | null;

const HERO_BOTTOM_BUFFER = 28;
const LIGHT_TOP_OFFSET = 48;
const TOP_REVEAL_SCROLL_Y = 20;

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function getScrollDeltaThreshold(): number {
  if (typeof window.matchMedia !== "function") return 6;
  return window.matchMedia("(pointer: coarse)").matches ? 2 : 6;
}

function resolveMarketingHeroSurface(context: MarketingHeroContext): HomeHeaderSurface {
  if (!context) return "light";

  const heroSelector =
    context === "home"
      ? ".hm-hero"
      : context === "calculators-hub"
        ? ".pg-calc-hub-landing-hero"
        : ".pg-reports-hub-landing-hero";
  const lightSelector =
    context === "home"
      ? ".hm-trust"
      : context === "calculators-hub"
        ? ".pg-calc-hub-light"
        : ".pg-reports-hub-light";

  const hero = document.querySelector<HTMLElement>(heroSelector);
  const lightSection = document.querySelector<HTMLElement>(lightSelector);

  if (!hero || !lightSection) {
    return getScrollTop() > 80 ? "light" : "hero";
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
 * Marketing header: glass/dark theme by scroll position; hide on scroll down,
 * reveal slowly on scroll up. At the very top of the page, always visible.
 */
export function useHomeHeaderSurface(heroContext: MarketingHeroContext): HomeHeaderScrollState {
  const [surface, setSurface] = useState<HomeHeaderSurface>(heroContext ? "hero" : "light");
  const [revealed, setRevealed] = useState(true);
  const lastScrollY = useRef(0);
  const revealedRef = useRef(true);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    lastScrollY.current = getScrollTop();
    revealedRef.current = true;

    const update = () => {
      const scrollY = getScrollTop();
      const delta = scrollY - lastScrollY.current;
      const threshold = getScrollDeltaThreshold();

      const nextSurface = heroContext ? resolveMarketingHeroSurface(heroContext) : "light";
      setSurface(nextSurface);

      if (heroContext) {
        let nextRevealed = revealedRef.current;
        if (scrollY <= TOP_REVEAL_SCROLL_Y) {
          nextRevealed = true;
        } else if (delta > threshold) {
          nextRevealed = false;
        } else if (delta < -threshold) {
          nextRevealed = true;
        }

        if (nextRevealed !== revealedRef.current) {
          revealedRef.current = nextRevealed;
          setRevealed(nextRevealed);
        }
      } else if (!revealedRef.current) {
        revealedRef.current = true;
        setRevealed(true);
      }

      lastScrollY.current = scrollY;
    };

    const scheduleUpdate = () => {
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        update();
      });
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    document.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("touchmove", scheduleUpdate, { passive: true });
    window.addEventListener("touchend", scheduleUpdate, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (rafId.current != null) {
        window.cancelAnimationFrame(rafId.current);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      document.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("touchmove", scheduleUpdate);
      window.removeEventListener("touchend", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, [heroContext]);

  return { surface, revealed };
}
