import { homepageFeatureBenefits } from "../../data/homepageFeatures";
import { Container } from "../ui/Container";
import { Grid } from "../ui/Grid";
import { Section } from "../ui/Section";
import { HomeFeatureIcon } from "./HomeFeatureIcon";

export function HomeFeaturesBenefitsSection() {
  return (
    <Section id="why-us" className="pg-home-light-section pg-home-features-section">
      <Container>
        <header className="pg-home-features-head">
          <p className="pg-home-qstart-eyebrow">Why use our calculators</p>
          <h2 className="pg-h2 pg-home-features-title">Clear numbers before expensive decisions.</h2>
          <p className="pg-lead pg-home-features-lead">
            Property decisions are too expensive for guesswork. Our calculators help you understand the cost, compare
            scenarios and move forward with better confidence.
          </p>
        </header>

        <Grid cols={4} className="pg-home-features-grid">
          {homepageFeatureBenefits.map((f) => (
            <div key={f.id} className="pg-home-quick-card pg-home-light-card pg-home-quick-card--with-icon">
              <HomeFeatureIcon iconKey={f.iconKey} label={f.title} />
              <div>
                <div className="pg-home-quick-title">{f.title}</div>
                <div className="pg-home-quick-desc">{f.body}</div>
              </div>
            </div>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
