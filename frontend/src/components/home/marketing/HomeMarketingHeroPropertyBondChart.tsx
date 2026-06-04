import { homepagePreviewProperty } from "../../../data/homepagePreviewContent";

/** Full-width bond vs rent income chart for hero cube property slide. */
export function HomeMarketingHeroPropertyBondChart() {
  const chart = homepagePreviewProperty.bondVsIncome;
  const max = Math.max(...chart.bond, ...chart.income);

  return (
    <section className="hm-app-preview__panel hm-hero-cube__bond-chart" aria-hidden>
      <div className="hm-app-preview__panel-head">
        <h3 className="hm-app-preview__panel-title">{chart.title}</h3>
        <span className="hm-app-preview__panel-meta">{chart.meta}</span>
      </div>
      <div className="hm-hero-cube__bond-chart-bars" role="presentation">
        {chart.months.map((month, index) => {
          const bondHeight = Math.round((chart.bond[index] / max) * 100);
          const incomeHeight = Math.round((chart.income[index] / max) * 100);
          return (
            <div key={`${month}-${index}`} className="hm-hero-cube__bond-chart-group">
              <div className="hm-hero-cube__bond-chart-pair">
                <span
                  className="hm-hero-cube__bond-chart-bar hm-hero-cube__bond-chart-bar--bond"
                  style={{ height: `${bondHeight}%` }}
                />
                <span
                  className="hm-hero-cube__bond-chart-bar hm-hero-cube__bond-chart-bar--income"
                  style={{ height: `${incomeHeight}%` }}
                />
              </div>
              <span className="hm-hero-cube__bond-chart-month">{month}</span>
            </div>
          );
        })}
      </div>
      <div className="hm-hero-cube__bond-chart-legend">
        <span className="hm-hero-cube__bond-chart-legend-item hm-hero-cube__bond-chart-legend-item--bond">
          {chart.bondLabel} · R 9,840
        </span>
        <span className="hm-hero-cube__bond-chart-legend-item hm-hero-cube__bond-chart-legend-item--income">
          {chart.incomeLabel} · R 14,500
        </span>
      </div>
    </section>
  );
}
