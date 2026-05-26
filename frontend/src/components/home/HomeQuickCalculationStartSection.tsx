import { Link } from "react-router-dom";
import { homepageCalculators } from "../../data/homepageCalculators";
import { Container } from "../ui/Container";
import { HomeCalculatorIcon } from "./HomeCalculatorIcon";

function CtaArrowIcon() {
  return (
    <svg className="pg-home-qstart-cta-arrow" viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
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

export function HomeQuickCalculationStartSection() {
  return (
    <section
      id="quick-calculation-start"
      className="pg-home-qstart pg-home-qstart--with-launcher pg-home-light-section"
      aria-labelledby="home-qstart-heading"
    >
      <Container className="pg-container--marketing-wide">
        <p className="pg-home-qstart-eyebrow">Use our powerful property calculators</p>
        <h2 id="home-qstart-heading" className="pg-home-qstart-heading">
          Everything you need to calculate smarter property decisions.
        </h2>
        <p className="pg-home-qstart-lead">
          Start with the numbers that matter most. Compare repayments, affordability, yields, costs and investment
          outcomes before you commit.
        </p>

        <ul className="pg-home-qstart-grid">
          {homepageCalculators.map((c) => (
            <li key={c.id} className="pg-home-qstart-cell">
              <Link
                to={c.route}
                className="pg-home-qstart-card pg-home-light-card"
                aria-label={`${c.title}: open calculator`}
              >
                <div className="pg-home-qstart-card-body">
                  <div className="pg-home-qstart-card-iconrow">
                    <HomeCalculatorIcon slug={c.templateKey} label={c.title} />
                  </div>
                  <h3 className="pg-home-qstart-card-title">{c.title}</h3>
                  <p className="pg-home-qstart-card-desc">{c.shortDescription}</p>
                  <span className="pg-home-qstart-card-cta" aria-hidden="true">
                    Calculate
                    <CtaArrowIcon />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
