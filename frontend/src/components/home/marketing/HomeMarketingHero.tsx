import { ButtonLink } from "../../ui/Button";
import { Container } from "../../ui/Container";
import { homepageHero, homepageHeroDashboardMock } from "../../../data/homepageMarketingContent";

export function HomeMarketingHero() {
  return (
    <header className="hm-hero" aria-labelledby="hm-hero-heading">
      <div className="hm-hero-glow" aria-hidden />
      <Container className="pg-container--marketing-wide hm-hero-grid">
        <div className="hm-hero-copy">
          <p className="hm-hero-eyebrow">{homepageHero.eyebrow}</p>
          <h1 id="hm-hero-heading" className="hm-hero-title">
            {homepageHero.headline}
          </h1>
          <p className="hm-hero-subtitle">{homepageHero.subheadline}</p>
          <div className="hm-hero-ctas">
            <ButtonLink href={homepageHero.primaryCta.href} variant="primary" size="lg">
              {homepageHero.primaryCta.label}
            </ButtonLink>
            <ButtonLink href={homepageHero.secondaryCta.href} variant="secondary" size="lg">
              {homepageHero.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
        <div className="hm-hero-visual">
          <HomeMarketingDashboardMock />
        </div>
      </Container>
    </header>
  );
}

function HomeMarketingDashboardMock() {
  const mock = homepageHeroDashboardMock;

  return (
    <div
      className="hm-dash-mock"
      role="img"
      aria-label="Example portfolio dashboard showing sample value, cash flow, ROI, occupancy, report preview and chart"
    >
      <div className="hm-dash-mock__chrome">
        <span className="hm-dash-mock__dot" />
        <span className="hm-dash-mock__dot" />
        <span className="hm-dash-mock__dot" />
        <span className="hm-dash-mock__title">Portfolio dashboard</span>
        <span className="hm-dash-mock__pill">Live view</span>
      </div>

      <div className="hm-dash-mock__body">
        <p className="hm-dash-mock__disclaimer">{mock.disclaimer}</p>

        <div className="hm-dash-mock__metrics">
          {mock.metrics.map((m) => (
            <div key={m.key} className={`hm-dash-mock__metric hm-dash-mock__metric--${m.tone}`}>
              <span className="hm-dash-mock__metric-label">{m.label}</span>
              <span className="hm-dash-mock__metric-value">{m.value}</span>
              <span className="hm-dash-mock__metric-hint">{m.hint}</span>
            </div>
          ))}
        </div>

        <div className="hm-dash-mock__lower">
          <div className="hm-dash-mock__chart" aria-hidden>
            <span className="hm-dash-mock__chart-title">{mock.chart.caption}</span>
            <div className="hm-dash-mock__bars">
              {mock.chart.bars.map((h, i) => (
                <span key={i} className="hm-dash-mock__bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          <div className="hm-dash-mock__report">
            <div className="hm-dash-mock__report-head">
              <span className="hm-dash-mock__report-title">{mock.reportPreview.title}</span>
              <span className="hm-dash-mock__report-badge">{mock.reportPreview.status}</span>
            </div>
            <ul className="hm-dash-mock__report-rows">
              {mock.reportPreview.rows.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
            <div className="hm-dash-mock__report-bar" aria-hidden>
              <span style={{ width: "72%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
