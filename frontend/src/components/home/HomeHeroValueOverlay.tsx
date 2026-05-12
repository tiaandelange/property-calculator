import { useId } from "react";

/**
 * Decorative sample metrics for marketing hero (not live data).
 * Anchored in the hero visual; stacks above gradient fades (see `.pg-home-hero-visual .pg-home-hero-overlay`).
 */
export function HomeHeroValueOverlay() {
  const gradId = useId().replace(/:/g, "");

  return (
    <div
      className="pg-home-hero-overlay pg-home-hero-property-value-card"
      role="group"
      aria-label="Illustrative property value trend"
    >
      <div className="pg-home-hero-overlay-body">
        <div className="pg-home-hero-overlay-kicker">Property value</div>
        <div className="pg-home-hero-overlay-value">R2,300,000</div>
        <div className="pg-home-hero-overlay-meta-row">
          <span className="pg-home-hero-overlay-trend">+12.5%</span>
          <span className="pg-home-hero-overlay-caption">Last 12 months</span>
        </div>
      </div>
      <div className="pg-home-hero-overlay-chart-wrap" aria-hidden="true">
        <svg className="pg-home-hero-overlay-chart-svg" viewBox="0 0 240 56" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="pg-home-hero-overlay-chart-grad-start" />
              <stop offset="100%" className="pg-home-hero-overlay-chart-grad-end" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${gradId})`}
            d="M 12 44 L 40 38 L 72 32 L 108 24 L 144 18 L 180 14 L 210 10 L 228 8 L 228 56 L 12 56 Z"
          />
          <path
            className="pg-home-hero-overlay-chart-line"
            d="M 12 44 L 40 38 L 72 32 L 108 24 L 144 18 L 180 14 L 210 10 L 228 8"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
