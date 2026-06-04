import type { CSSProperties } from "react";

const HUB_HERO_PARTICLES = [
  { kind: "dot", left: "8%", top: "22%", size: 7, delay: 0, duration: 12 },
  { kind: "dot", left: "24%", top: "58%", size: 6, delay: 0.6, duration: 11 },
  { kind: "dot", left: "42%", top: "14%", size: 8, delay: 0.2, duration: 13 },
  { kind: "dot", left: "62%", top: "72%", size: 7, delay: 1.1, duration: 14 },
  { kind: "dot", left: "78%", top: "28%", size: 6, delay: 0.4, duration: 10 },
  { kind: "dot", left: "90%", top: "48%", size: 8, delay: 1.5, duration: 12 },
  { kind: "dot", left: "14%", top: "78%", size: 6, delay: 0.9, duration: 15 },
  { kind: "dot", left: "52%", top: "36%", size: 7, delay: 1.8, duration: 11 }
] as const;

/** Decorative glow dots behind the calculators hub landing hero. */
export function CalculatorHubLandingHeroBackdrop() {
  return (
    <div className="pg-calc-hub-landing-hero__backdrop" aria-hidden>
      {HUB_HERO_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="pg-calc-hub-landing-hero__backdrop-dot"
          style={
            {
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
