import { useEffect, useId, useState } from "react";
import { Autoplay, EffectCube } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { HomeMarketingHeroAppPreview } from "./HomeMarketingHeroAppPreview";
import {
  HomeMarketingPortfolioPreview,
  HomeMarketingPropertyPreview
} from "./HomeMarketingModulePreviews";
import "swiper/css";
import "swiper/css/effect-cube";

const AUTOPLAY_MS = 2600;

const HERO_DASHBOARD_SLIDES = [
  {
    id: "portfolio-overview",
    badge: "Portfolio overview",
    content: <HomeMarketingHeroAppPreview heroCube />
  },
  {
    id: "portfolio-analytics",
    badge: "Portfolio analytics",
    content: <HomeMarketingPortfolioPreview showLabel={false} heroCube />
  },
  {
    id: "property-dashboard",
    badge: "Property dashboard",
    content: <HomeMarketingPropertyPreview showLabel={false} heroCube />
  }
] as const;

export function HomeMarketingHeroCubeCarousel() {
  const rootId = useId();
  const labelId = `${rootId}-label`;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="hm-hero-cube" aria-labelledby={labelId}>
      <p id={labelId} className="pg-visually-hidden">
        Rotating preview of Proplytic property dashboards
      </p>
      <Swiper
        className="hm-hero-cube__swiper"
        modules={[EffectCube, Autoplay]}
        effect="cube"
        grabCursor
        loop
        speed={1000}
        watchSlidesProgress
        cubeEffect={{
          shadow: false,
          slideShadows: true,
          shadowOffset: 10,
          shadowScale: 0.94
        }}
        autoplay={
          reducedMotion
            ? false
            : {
                delay: AUTOPLAY_MS,
                pauseOnMouseEnter: true,
                disableOnInteraction: false
              }
        }
      >
        {HERO_DASHBOARD_SLIDES.map((slide) => (
          <SwiperSlide key={slide.id} className="hm-hero-cube__slide">
            <span className="hm-hero-cube__badge">{slide.badge}</span>
            <div className="hm-hero-cube__slide-inner">{slide.content}</div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
