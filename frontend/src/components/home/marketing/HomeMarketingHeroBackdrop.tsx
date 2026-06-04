import type { CSSProperties } from "react";

/** Decorative animated dots and % symbols behind the marketing hero (CSS only). */
const HERO_BACKDROP_PARTICLES = [
  { kind: "dot", left: "6%", top: "16%", size: 8, delay: 0, duration: 11 },
  { kind: "pct", left: "18%", top: "68%", size: 14, delay: 0.8, duration: 13 },
  { kind: "dot", left: "32%", top: "10%", size: 7, delay: 0.3, duration: 10 },
  { kind: "pct", left: "46%", top: "52%", size: 13, delay: 1.4, duration: 14 },
  { kind: "dot", left: "58%", top: "24%", size: 9, delay: 0.6, duration: 12 },
  { kind: "pct", left: "70%", top: "78%", size: 15, delay: 1.1, duration: 15 },
  { kind: "dot", left: "82%", top: "12%", size: 7, delay: 0.15, duration: 11 },
  { kind: "pct", left: "10%", top: "38%", size: 12, delay: 2, duration: 16 },
  { kind: "dot", left: "40%", top: "84%", size: 8, delay: 0.9, duration: 12 },
  { kind: "pct", left: "54%", top: "4%", size: 13, delay: 2.3, duration: 14 },
  { kind: "dot", left: "90%", top: "44%", size: 8, delay: 1.6, duration: 10 },
  { kind: "pct", left: "26%", top: "28%", size: 11, delay: 1.9, duration: 13 },
  { kind: "dot", left: "50%", top: "34%", size: 9, delay: 0.45, duration: 14 },
  { kind: "pct", left: "64%", top: "60%", size: 14, delay: 1.2, duration: 15 },
  { kind: "dot", left: "2%", top: "58%", size: 8, delay: 1.8, duration: 11 },
  { kind: "pct", left: "44%", top: "72%", size: 12, delay: 0.7, duration: 13 },
  { kind: "dot", left: "74%", top: "46%", size: 7, delay: 2.5, duration: 12 },
  { kind: "pct", left: "86%", top: "30%", size: 11, delay: 0.5, duration: 14 },
  { kind: "dot", left: "22%", top: "88%", size: 8, delay: 1.3, duration: 11 },
  { kind: "pct", left: "36%", top: "18%", size: 13, delay: 2.7, duration: 15 }
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
