import { Link } from "react-router-dom";
import { Container } from "../ui/Container";
import {
  HOMEPAGE_BRAND_LEGAL_NAME,
  marketingFooterBrandTagline,
  marketingFooterCalculatorNavItems,
  marketingFooterCompanyLinks,
  marketingFooterLegalDisclaimer,
  marketingFooterLegalLinks
} from "../../data/homeMarketingFooter";

function FooterNavList({
  ariaLabel,
  title,
  items
}: {
  ariaLabel: string;
  title: string;
  items: readonly { readonly label: string; readonly to: string }[];
}) {
  return (
    <nav className="pg-home-footer-col" aria-label={ariaLabel}>
      <p className="pg-home-footer-col-title">{title}</p>
      <ul className="pg-home-footer-list">
        {items.map((item) => (
          <li key={item.label}>
            <Link to={item.to} className="pg-home-footer-link">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function HomePublicFooter() {
  return (
    <footer className="pg-home-footer pg-home-footer--marketing" role="contentinfo">
      <Container className="pg-container--marketing-wide">
        <div className="pg-home-footer-grid">
          <div className="pg-home-footer-brand">
            <Link to="/" className="pg-home-footer-brand-name">
              {HOMEPAGE_BRAND_LEGAL_NAME}
            </Link>
            <p className="pg-home-footer-tagline">{marketingFooterBrandTagline}</p>
          </div>

          <FooterNavList ariaLabel="Calculators" title="Calculators" items={marketingFooterCalculatorNavItems} />

          <FooterNavList ariaLabel="Company" title="Company" items={[...marketingFooterCompanyLinks]} />

          <FooterNavList ariaLabel="Legal" title="Legal" items={[...marketingFooterLegalLinks]} />
        </div>

        <div className="pg-home-footer-bottom">
          <p className="pg-home-footer-disclaimer">{marketingFooterLegalDisclaimer}</p>
          <p className="pg-home-footer-copy">
            © 2026 {HOMEPAGE_BRAND_LEGAL_NAME}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
