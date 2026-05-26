import { homepageTrustStats } from "../../data/homepageTrustStats";
import { getTrustIconConfig } from "../../icons/trustIcons";
import { Container } from "../ui/Container";
import { IconContainer } from "../ui/IconContainer";

export function HomeTrustStatsStrip() {
  return (
    <section className="pg-home-trust-strip" aria-label="Trust and product highlights">
      <Container>
        <div className="pg-home-trust-strip-panel">
          <ul className="pg-home-trust-strip-grid">
            {homepageTrustStats.map((s) => {
              const { icon, accent } = getTrustIconConfig(s.icon);
              return (
                <li key={s.id} className="pg-home-trust-strip-cell">
                  <div className="pg-home-trust-strip-item">
                    <IconContainer icon={icon} accent={accent} size="md" className="pg-home-trust-strip-icon" />
                    <div className="pg-home-trust-strip-value">{s.value}</div>
                    <div className="pg-home-trust-strip-hint">{s.hint}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
