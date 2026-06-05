import type { HOME_HERO_FLOATING_METRICS } from "./homeHeroDemoData";

type FloatingMetric = (typeof HOME_HERO_FLOATING_METRICS)[number];

export function HomeHeroFloatingMetricCard({ metric }: { metric: FloatingMetric }) {
  return (
    <div
      className={`hm-hero-float-card hm-hero-float-card--${metric.placement}`}
      style={{ animationDelay: `${metric.delay}s` }}
    >
      <span className="hm-hero-float-card__label">{metric.label}</span>
      <strong className="hm-hero-float-card__value">{metric.value}</strong>
      <span className={`hm-hero-float-card__change hm-hero-float-card__change--${metric.tone}`}>
        {metric.change}
      </span>
    </div>
  );
}
