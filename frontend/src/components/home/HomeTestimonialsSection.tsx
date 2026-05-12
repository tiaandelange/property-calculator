import { PLACEHOLDER_HOMEPAGE_TESTIMONIALS } from "../../data/homepagePlaceholderTestimonials";
import { Container } from "../ui/Container";
import { Grid } from "../ui/Grid";
import { Section } from "../ui/Section";
import { HomeTestimonialAvatar } from "./HomeTestimonialAvatar";

export function HomeTestimonialsSection() {
  return (
    <Section id="reviews" className="pg-home-light-section pg-home-testimonials-section">
      <Container>
        <header className="pg-home-features-head">
          <p className="pg-home-qstart-eyebrow">Customer proof</p>
          <h2 className="pg-h2 pg-home-features-title">Trusted by people making serious property decisions.</h2>
          <p className="pg-lead pg-home-features-lead">
            Replace these placeholder testimonials with verified customer feedback before launch.
          </p>
        </header>

        <Grid cols={3} className="pg-home-testimonials-grid">
          {PLACEHOLDER_HOMEPAGE_TESTIMONIALS.map((t) => (
            <figure
              key={t.id}
              className="pg-home-testimonial-card pg-home-light-card"
              data-testimonial-source="placeholder"
            >
              <blockquote className="pg-home-testimonial-bq">
                <p>{t.quote}</p>
              </blockquote>
              <figcaption className="pg-home-testimonial-cap">
                <HomeTestimonialAvatar src={t.avatarSrc} name={t.name} />
                <div className="pg-home-testimonial-meta">
                  <span
                    className="pg-home-testimonial-placeholder-label"
                    title="Sample copy only — not verified customer feedback. Remove or replace before launch."
                  >
                    Placeholder
                  </span>
                  <cite className="pg-home-testimonial-cite">{t.name}</cite>
                  <span className="pg-home-testimonial-role">{t.role}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
