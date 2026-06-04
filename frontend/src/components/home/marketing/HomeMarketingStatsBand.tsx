import type { HomepageMarketingStat } from "../../../data/homepageMarketingContent";
import { Container } from "../../ui/Container";
import { HomeMarketingAnimatedStat } from "./HomeMarketingAnimatedStat";

export function HomeMarketingStatsBand({
  id,
  tone = "dark",
  stats
}: {
  id: string;
  tone?: "dark" | "light";
  stats: readonly HomepageMarketingStat[];
}) {
  return (
    <section
      id={id}
      className={`hm-stats-band hm-stats-band--${tone}`}
      aria-label="Illustrative property portfolio metrics"
    >
      <Container className="pg-container--marketing-wide">
        <ul className="hm-stats-band__grid">
          {stats.map((stat) => (
            <li key={stat.id}>
              <HomeMarketingAnimatedStat stat={stat} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
