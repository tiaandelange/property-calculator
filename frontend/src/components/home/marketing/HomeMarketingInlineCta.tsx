import { ButtonLink } from "../../ui/Button";
import { Container } from "../../ui/Container";

export function HomeMarketingInlineCta({
  line,
  primary,
  secondary
}: {
  line: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="hm-inline-cta" aria-label="Get started with Proplytic">
      <Container className="pg-container--marketing-wide">
        <div className="hm-inline-cta__inner">
          <p className="hm-inline-cta__line">{line}</p>
          <div className="hm-inline-cta__actions">
            <ButtonLink href={primary.href} variant="primary" size="md">
              {primary.label}
            </ButtonLink>
            {secondary ? (
              <ButtonLink href={secondary.href} variant="secondary" size="md">
                {secondary.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
