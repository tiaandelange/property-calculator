import type { CSSProperties } from "react";

const REPORTS_HERO_PARTICLES = [
  { left: "6%", top: "20%", size: 7, delay: 0, duration: 13 },
  { left: "22%", top: "62%", size: 6, delay: 0.5, duration: 11 },
  { left: "38%", top: "12%", size: 8, delay: 0.3, duration: 14 },
  { left: "58%", top: "70%", size: 7, delay: 1.2, duration: 12 },
  { left: "74%", top: "26%", size: 6, delay: 0.8, duration: 15 },
  { left: "88%", top: "44%", size: 8, delay: 1.4, duration: 11 },
  { left: "12%", top: "80%", size: 6, delay: 0.2, duration: 13 },
  { left: "48%", top: "34%", size: 7, delay: 1.6, duration: 12 }
] as const;

export function ReportsLandingHeroBackdrop() {
  return (
    <div className="pg-reports-hub-landing-hero__backdrop" aria-hidden>
      {REPORTS_HERO_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="pg-reports-hub-landing-hero__backdrop-dot"
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
