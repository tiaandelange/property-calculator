import { homepagePreviewProperty } from "../../../data/homepagePreviewContent";

const CHART_W = 280;
const CHART_H = 96;
const PAD_X = 10;
const PAD_Y = 10;

function seriesPoints(
  values: readonly number[],
  max: number,
  width: number,
  height: number
): string {
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;
  return values
    .map((value, index) => {
      const x = PAD_X + (index / Math.max(values.length - 1, 1)) * innerW;
      const y = PAD_Y + (1 - value / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Full-width bond vs rent income line chart for hero cube property slide. */
export function HomeMarketingHeroPropertyBondChart() {
  const chart = homepagePreviewProperty.bondVsIncome;
  const max = Math.max(...chart.bond, ...chart.income);
  const bondPoints = seriesPoints(chart.bond, max, CHART_W, CHART_H);
  const incomePoints = seriesPoints(chart.income, max, CHART_W, CHART_H);

  return (
    <section className="hm-app-preview__panel hm-hero-cube__bond-chart" aria-hidden>
      <div className="hm-app-preview__panel-head">
        <h3 className="hm-app-preview__panel-title">{chart.title}</h3>
        <span className="hm-app-preview__panel-meta">{chart.meta}</span>
      </div>
      <div className="hm-hero-cube__bond-chart-plot">
        <svg
          className="hm-hero-cube__bond-chart-svg"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          role="presentation"
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              className="hm-hero-cube__bond-chart-grid"
              x1={PAD_X}
              x2={CHART_W - PAD_X}
              y1={PAD_Y + ratio * (CHART_H - PAD_Y * 2)}
              y2={PAD_Y + ratio * (CHART_H - PAD_Y * 2)}
            />
          ))}
          <polyline
            className="hm-hero-cube__bond-chart-line hm-hero-cube__bond-chart-line--bond"
            fill="none"
            points={bondPoints}
          />
          <polyline
            className="hm-hero-cube__bond-chart-line hm-hero-cube__bond-chart-line--income"
            fill="none"
            points={incomePoints}
          />
        </svg>
        <div className="hm-hero-cube__bond-chart-months" role="presentation">
          {chart.months.map((month) => (
            <span key={month} className="hm-hero-cube__bond-chart-month">
              {month}
            </span>
          ))}
        </div>
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
