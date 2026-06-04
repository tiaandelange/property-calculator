import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { HomeMarketingHeroAppPreview } from "./HomeMarketingHeroAppPreview";
import {
  HomeMarketingPortfolioPreview,
  HomeMarketingPropertyPreview
} from "./HomeMarketingModulePreviews";

const AUTOPLAY_MS = 2600;
const FACE_COUNT = 3;
const FACE_ANGLE = 360 / FACE_COUNT;

type HeroDashboardSlide = {
  id: string;
  badge: string;
  render: () => ReactNode;
};

const HERO_DASHBOARD_SLIDES: readonly HeroDashboardSlide[] = [
  {
    id: "portfolio-overview",
    badge: "Portfolio overview",
    render: () => <HomeMarketingHeroAppPreview />
  },
  {
    id: "portfolio-analytics",
    badge: "Portfolio analytics",
    render: () => <HomeMarketingPortfolioPreview showLabel={false} />
  },
  {
    id: "property-dashboard",
    badge: "Property dashboard",
    render: () => <HomeMarketingPropertyPreview showLabel={false} />
  }
] as const;

export function HomeMarketingHeroCubeCarousel() {
  const rootId = useId();
  const labelId = `${rootId}-label`;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % FACE_COUNT);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(goNext, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, goNext]);

  return (
    <div
      className="hm-hero-cube"
      aria-labelledby={labelId}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <p id={labelId} className="pg-visually-hidden">
        Rotating preview of Proplytic property dashboards
      </p>
      <div className="hm-hero-cube__scene">
        <div
          className={`hm-hero-cube__cube${reducedMotion ? " hm-hero-cube__cube--reduced-motion" : ""}`}
          style={{ transform: `rotateY(${activeIndex * -FACE_ANGLE}deg)` }}
          aria-live="polite"
        >
          {HERO_DASHBOARD_SLIDES.map((slide, index) => (
            <article
              key={slide.id}
              className="hm-hero-cube__face"
              style={{ transform: `rotateY(${index * FACE_ANGLE}deg) translateZ(var(--hm-hero-cube-depth))` }}
              aria-hidden={index !== activeIndex}
            >
              <span className="hm-hero-cube__badge">{slide.badge}</span>
              <div className="hm-hero-cube__slide-inner">{slide.render()}</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
