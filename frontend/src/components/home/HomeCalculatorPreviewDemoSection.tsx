/**
 * Static marketing preview only — not connected to calculator engine or API.
 * Sample numbers are illustrative (30-year term example); live calculator: /calculators/monthly-payment.
 */
import { useId } from "react";
import { Link } from "react-router-dom";
import { calculatorRouteForSlug } from "../../data/homepageCalculators";
import { Container } from "../ui/Container";
import { Section } from "../ui/Section";

function CtaArrowIcon() {
  return (
    <svg className="pg-home-calc-demo-cta-arrow" viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DemoChart({ gradPrincipalId, gradInterestId }: { gradPrincipalId: string; gradInterestId: string }) {
  return (
    <div className="pg-home-calc-demo-chart" aria-hidden="true">
      <div className="pg-home-calc-demo-chart-axis">
        <span>R3M</span>
        <span>R2M</span>
        <span>R1M</span>
        <span>0</span>
      </div>
      <svg className="pg-home-calc-demo-chart-svg" viewBox="0 0 220 88" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradPrincipalId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--home-calc-demo-chart-principal)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--home-calc-demo-chart-principal)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={gradInterestId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--home-calc-demo-chart-interest)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--home-calc-demo-chart-interest)" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <path
          className="pg-home-calc-demo-chart-area-principal"
          d="M0,72 C36,70 72,58 108,44 C144,30 180,22 220,18 L220,88 L0,88 Z"
          fill={`url(#${gradPrincipalId})`}
        />
        <path
          className="pg-home-calc-demo-chart-area-interest"
          d="M0,52 C40,48 80,38 120,28 C160,20 200,14 220,10 L220,88 L0,88 Z"
          fill={`url(#${gradInterestId})`}
        />
        <path
          className="pg-home-calc-demo-chart-line-interest"
          d="M0,52 C40,48 80,38 120,28 C160,20 200,14 220,10"
          fill="none"
          stroke="var(--home-calc-demo-chart-line)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <div className="pg-home-calc-demo-chart-x">
        <span>0</span>
        <span>10</span>
        <span>20</span>
        <span>30 yrs</span>
      </div>
    </div>
  );
}

/** Decorative slider track + thumb (no calculation binding). */
function DemoSlider({ fillPercent }: { fillPercent: number }) {
  return (
    <div className="pg-home-calc-demo-slider" aria-hidden="true">
      <div className="pg-home-calc-demo-slider-track">
        <div className="pg-home-calc-demo-slider-fill" style={{ width: `${fillPercent}%` }} />
      </div>
      <div className="pg-home-calc-demo-slider-thumb" style={{ left: `${fillPercent}%` }} />
    </div>
  );
}

export function HomeCalculatorPreviewDemoSection() {
  const uid = useId().replace(/:/g, "");
  const gradPrincipalId = `pg-home-calc-demo-p-${uid}`;
  const gradInterestId = `pg-home-calc-demo-i-${uid}`;

  return (
    <Section id="how-it-works" className="pg-home-calc-demo-section">
      <Container>
        <div className="pg-home-calc-demo-layout">
          <div className="pg-home-calc-demo-copy">
            <p className="pg-home-calc-demo-eyebrow">Plan with confidence</p>
            <h2 className="pg-home-calc-demo-heading">
              Better calculations. <span className="pg-home-calc-demo-heading-accent">Smarter</span>{" "}
              decisions.
            </h2>
            <p className="pg-home-calc-demo-lead">
              Whether you are buying your first home or building a property portfolio, our tools help you understand
              the numbers before you take the next step.
            </p>
            <Link to="/login" className="pg-btn pg-btn-primary pg-home-calc-demo-primary-cta">
              Get started free
              <CtaArrowIcon />
            </Link>
          </div>

          <div className="pg-home-calc-demo-panel" aria-label="Sample mortgage calculator interface (preview only)">
            <div className="pg-home-calc-demo-panel-chrome">Mortgage Calculator</div>
            <div className="pg-home-calc-demo-panel-body">
              <div className="pg-home-calc-demo-panel-grid">
                <div className="pg-home-calc-demo-inputs">
                  <div className="pg-home-calc-demo-field">
                    <span className="pg-home-calc-demo-label">Property price (R)</span>
                    <div className="pg-home-calc-demo-valuebox" tabIndex={-1}>
                      R2,300,000
                    </div>
                    <DemoSlider fillPercent={100} />
                  </div>
                  <div className="pg-home-calc-demo-field">
                    <span className="pg-home-calc-demo-label">Deposit (R)</span>
                    <div className="pg-home-calc-demo-valuebox" tabIndex={-1}>
                      R230,000
                    </div>
                    <DemoSlider fillPercent={10} />
                  </div>
                  <div className="pg-home-calc-demo-field pg-home-calc-demo-field--row">
                    <div>
                      <span className="pg-home-calc-demo-label">Interest rate (p.a.)</span>
                      <div className="pg-home-calc-demo-select" tabIndex={-1}>
                        11.25%
                      </div>
                    </div>
                    <div>
                      <span className="pg-home-calc-demo-label">Loan term</span>
                      <div className="pg-home-calc-demo-select" tabIndex={-1}>
                        30 years
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pg-home-calc-demo-results">
                  <p className="pg-home-calc-demo-results-kicker">Your results</p>
                  <div className="pg-home-calc-demo-hero-metric">
                    <span className="pg-home-calc-demo-hero-metric-label">Monthly repayment</span>
                    <span className="pg-home-calc-demo-hero-metric-value">R20,105</span>
                  </div>
                  <dl className="pg-home-calc-demo-dl">
                    <dt className="pg-home-calc-demo-dt">Total interest payable</dt>
                    <dd className="pg-home-calc-demo-dd">R5,167,840</dd>
                    <dt className="pg-home-calc-demo-dt">Total repayable</dt>
                    <dd className="pg-home-calc-demo-dd">R7,237,840</dd>
                  </dl>
                  <DemoChart gradPrincipalId={gradPrincipalId} gradInterestId={gradInterestId} />
                  <div className="pg-home-calc-demo-results-footer">
                    <Link
                      to={calculatorRouteForSlug("monthly-payment")}
                      className="pg-home-calc-demo-ghost-link"
                    >
                      View amortization schedule
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
