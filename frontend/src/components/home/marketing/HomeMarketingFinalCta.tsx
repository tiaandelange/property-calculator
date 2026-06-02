import { homepageFinalCta } from "../../../data/homepageMarketingContent";
import { ButtonLink } from "../../ui/Button";
import { Container } from "../../ui/Container";

export function HomeMarketingFinalCta() {
  return (
    <section className="hm-final-cta" aria-labelledby="hm-final-cta-heading">
      <Container className="pg-container--marketing-wide">
        <h2 id="hm-final-cta-heading" className="hm-final-cta__title">
          {homepageFinalCta.headline}
        </h2>
        <div className="hm-final-cta__actions">
          <ButtonLink href={homepageFinalCta.primary.href} variant="primary" size="lg">
            {homepageFinalCta.primary.label}
          </ButtonLink>
          <ButtonLink href={homepageFinalCta.secondary.href} variant="secondary" size="lg">
            {homepageFinalCta.secondary.label}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
