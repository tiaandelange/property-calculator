import { useEffect, useRef, useState } from "react";
import type { HomepageMarketingStat } from "../../../data/homepageMarketingContent";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";
import { formatHomepageMarketingStat } from "./homeMarketingStatFormat";

export function HomeMarketingAnimatedStat({ stat }: { stat: HomepageMarketingStat }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const animated = useAnimatedNumber(stat.value, {
    enabled: active && !reducedMotion,
    durationMs: 2000,
    decimals: stat.format === "percent" && !Number.isInteger(stat.value) ? 1 : 0
  });

  const displayValue = formatHomepageMarketingStat(
    reducedMotion && active ? stat.value : active ? animated : 0,
    stat
  );

  return (
    <div ref={ref} className="hm-stats-band__stat">
      <p className="hm-stats-band__value" aria-label={`${stat.label}: ${displayValue}`}>
        {displayValue}
      </p>
      <p className="hm-stats-band__label">{stat.label}</p>
    </div>
  );
}
