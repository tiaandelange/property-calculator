import { Link } from "react-router-dom";
import { Container } from "../ui/Container";
import { Section } from "../ui/Section";

function HomeFinalCtaMark() {
  return (
    <svg
      className="pg-home-final-cta-mark"
      viewBox="0 0 48 48"
      width={40}
      height={40}
      aria-hidden="true"
    >
      <path
        d="M10 20 L24 10 L38 20 V38 H10 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 38 V26 h16 v12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="28" y="14" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M31 18h6M31 21h4" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function HomeFinalCtaSection() {
  return (
    <Section className="pg-home-final-cta-section" aria-labelledby="home-final-cta-heading">
      <Container>
        <div className="pg-home-final-cta">
          <div className="pg-home-final-cta-grid">
            <div className="pg-home-final-cta-copy">
              <HomeFinalCtaMark />
              <h2 id="home-final-cta-heading" className="pg-home-final-cta-title">
                Ready to run the numbers?
              </h2>
              <p className="pg-home-final-cta-lead">
                Choose a calculator and get a clearer view of your next property decision.
              </p>
            </div>
            <div className="pg-home-final-cta-actions">
              <Link to="/calculators" className="pg-btn pg-btn-primary">
                Open calculators
              </Link>
              <Link to="/contact" className="pg-btn pg-btn-ghost">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
