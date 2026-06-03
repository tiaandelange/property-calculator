import { homepageTrustProof } from "../../../data/homepageMarketingContent";
import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import { Container } from "../../ui/Container";

export function HomeMarketingTrustStrip() {
  const proof = homepageTrustProof;

  return (
    <section className="hm-trust" aria-labelledby="hm-trust-heading">
      <Container className="pg-container--marketing-wide">
        <div className="hm-trust__intro">
          <h2 id="hm-trust-heading" className="hm-trust__headline">
            {proof.headline}
          </h2>
          <p className="hm-trust__subline">{proof.subline}</p>
        </div>
        <ul className="hm-trust__grid">
          {proof.items.map((item) => (
            <li key={item.id} className="hm-trust__card">
              <span className="hm-trust__icon" aria-hidden>
                <AppIcon name={item.icon as IconName} size="md" />
              </span>
              <span className="hm-trust__label">{item.label}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
