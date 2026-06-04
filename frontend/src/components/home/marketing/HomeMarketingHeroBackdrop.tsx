import type { CSSProperties } from "react";

/** Decorative animated dots and % symbols behind the marketing hero (CSS only). */
const HERO_BACKDROP_PARTICLES = [
  { kind: "dot", left: "8%", top: "18%", size: 6, delay: 0, duration: 14 },
  { kind: "pct", left: "22%", top: "72%", size: 11, delay: 1.2, duration: 16 },
  { kind: "dot", left: "38%", top: "12%", size: 5, delay: 0.4, duration: 12 },
  { kind: "pct", left: "52%", top: "58%", size: 10, delay: 2.1, duration: 18 },
  { kind: "dot", left: "68%", top: "28%", size: 7, delay: 0.8, duration: 15 },
  { kind: "pct", left: "78%", top: "82%", size: 12, delay: 1.6, duration: 17 },
  { kind: "dot", left: "88%", top: "14%", size: 5, delay: 0.2, duration: 13 },
  { kind: "pct", left: "14%", top: "42%", size: 9, delay: 2.8, duration: 19 },
  { kind: "dot", left: "44%", top: "88%", size: 6, delay: 1.1, duration: 14 },
  { kind: "pct", left: "62%", top: "6%", size: 10, delay: 3.2, duration: 16 },
  { kind: "dot", left: "92%", top: "48%", size: 5, delay: 1.9, duration: 12 },
  { kind: "pct", left: "30%", top: "32%", size: 8, delay: 2.4, duration: 15 },
  { kind: "dot", left: "56%", top: "38%", size: 7, delay: 0.6, duration: 17 },
  { kind: "pct", left: "72%", top: "64%", size: 11, delay: 1.4, duration: 18 },
  { kind: "dot", left: "4%", top: "62%", size: 6, delay: 2.2, duration: 13 },
  { kind: "pct", left: "48%", top: "76%", size: 9, delay: 0.9, duration: 16 }
] as const;

export function HomeMarketingHeroBackdrop() {
  return (
    <div className="hm-hero-backdrop" aria-hidden>
      {HERO_BACKDROP_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className={`hm-hero-backdrop__particle hm-hero-backdrop__particle--${particle.kind}`}
          style={
            {
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              fontSize: particle.kind === "pct" ? `${particle.size}px` : undefined,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`
            } as CSSProperties
          }
        >
          {particle.kind === "pct" ? "%" : null}
        </span>
      ))}
    </div>
  );
}
