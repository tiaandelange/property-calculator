import type { ReactNode } from "react";
import { HomeHeroImage } from "../home/HomeHeroImage";
import { Container } from "../ui/Container";

export function CalculatorToolHero({
  titleBefore,
  accent,
  titleAfter,
  lead,
  floatingLabel,
  floatingValue,
  floatingSub,
  loading,
  workspaceBelow
}: {
  titleBefore: string;
  accent: string;
  titleAfter: string;
  lead: string;
  floatingLabel?: string;
  floatingValue?: string;
  floatingSub?: string;
  loading?: boolean;
  /** Inputs + results grid — sits in the same dark header band as the hero (hub-style). */
  workspaceBelow?: ReactNode;
}) {
  return (
    <div className="pg-calc-hub-dark-band pg-calculator-tool-hero-band">
      <div className="pg-calc-hub-hero-base" aria-hidden="true" />
      <Container className="pg-container--marketing-wide pg-calc-hub-dark-band-inner">
        <div className="pg-home-hero-grid pg-calc-hub-hero-grid">
          <div className="pg-home-hero-col--copy">
            <div className="pg-calc-hub-hero-copy-stack">
              <h1 className="pg-calc-hub-hero-title">
                {titleBefore}
                <span className="pg-calc-hub-hero-accent">{accent}</span>
                {titleAfter}
              </h1>
              <p className="pg-calc-hub-hero-lead">{lead}</p>
              <ul className="pg-calc-hub-hero-pills" aria-label="Highlights">
                <li>Accurate results</li>
                <li>Adjust anytime</li>
                <li>Plan with confidence</li>
              </ul>
            </div>
          </div>
          <div className="pg-home-hero-col--visual">
            <div className="pg-home-hero-visual">
              <HomeHeroImage
                kind="property"
                alt=""
                decorative
                className="pg-home-hero-visual-img"
                width={1920}
                height={1080}
                fetchPriority="high"
              />
              <div className="pg-home-hero-image-fade pg-home-hero-image-fade-left" aria-hidden="true" />
              <div className="pg-home-hero-image-fade pg-home-hero-image-fade-bottom" aria-hidden="true" />
              <div className="pg-home-hero-image-fade pg-home-hero-image-fade-top" aria-hidden="true" />
              <aside className="pg-calc-hub-hero-floating" aria-label="Key result preview">
                <div className="pg-calc-hub-hero-floating-label">{floatingLabel ?? "Primary result"}</div>
                <div className="pg-calc-hub-hero-floating-value">{loading ? "…" : floatingValue ?? "—"}</div>
                {floatingSub ? <div className="pg-calc-hub-hero-floating-sub">{floatingSub}</div> : null}
                <svg className="pg-calc-hub-hero-spark" viewBox="0 0 120 32" aria-hidden="true">
                  <path
                    d="M0,28 L20,22 40,24 60,14 80,18 100,8 120,4"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </aside>
            </div>
          </div>
        </div>
        {workspaceBelow != null ? (
          <div className="pg-calculator-tool-header-workspace pg-calculator-tool-navy">{workspaceBelow}</div>
        ) : null}
      </Container>
    </div>
  );
}
