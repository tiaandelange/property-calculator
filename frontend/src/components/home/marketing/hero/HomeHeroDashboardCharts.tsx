import { HOME_HERO_DEMO } from "./homeHeroDemoData";

function scaleSeries(values: readonly number[], height: number, pad = 4) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (100 - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
}

function scaleSeriesCoords(values: readonly number[], height: number, pad = 4) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (100 - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return { x, y };
  });
}

/** Featured portfolio overview line chart — mirrors the real dashboard panel. */
export function HomeHeroPortfolioOverviewChart() {
  const trend = HOME_HERO_DEMO.cashFlowTrend;
  const values = trend.map((p) => p.value);
  const chartHeight = 88;
  const pad = 8;
  const baseline = chartHeight - pad;
  const coords = scaleSeriesCoords(values, chartHeight, pad);
  const linePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [
    `${coords[0]?.x ?? pad},${baseline}`,
    linePoints,
    `${coords[coords.length - 1]?.x ?? 100 - pad},${baseline}`
  ].join(" ");

  return (
    <div className="hm-hero-dash-overview-chart" aria-hidden>
      <svg viewBox={`0 0 100 ${chartHeight}`} className="hm-hero-dash-chart__svg hm-hero-dash-chart__svg--overview" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hm-hero-overview-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124, 92, 255, 0.32)" />
            <stop offset="100%" stopColor="rgba(124, 92, 255, 0.02)" />
          </linearGradient>
        </defs>
        {[22, 44, 66].map((y) => (
          <line key={y} x1={pad} y1={y} x2={100 - pad} y2={y} className="hm-hero-dash-chart__grid" />
        ))}
        <polygon points={areaPoints} className="hm-hero-dash-chart__area" fill="url(#hm-hero-overview-fill)" />
        <polyline points={linePoints} className="hm-hero-dash-chart__line hm-hero-dash-chart__line--overview" />
        {coords.map((pt, i) => (
          <circle key={trend[i]?.label ?? i} cx={pt.x} cy={pt.y} r={i === coords.length - 1 ? 2.6 : 1.8} className="hm-hero-dash-chart__dot" />
        ))}
      </svg>
      <div className="hm-hero-dash-overview-chart__labels">
        {trend.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

export function HomeHeroCashFlowLineChart() {
  const values = HOME_HERO_DEMO.cashFlowTrend.map((p) => p.value);
  const points = scaleSeries(values, 48, 6).join(" ");

  return (
    <svg viewBox="0 0 100 52" className="hm-hero-dash-chart__svg" aria-hidden>
      {[14, 28, 42].map((y) => (
        <line key={y} x1="6" y1={y} x2="94" y2={y} className="hm-hero-dash-chart__grid" />
      ))}
      <polyline points={points} className="hm-hero-dash-chart__line" />
      {points.split(" ").slice(-1).map((pt) => {
        const [cx, cy] = pt.split(",").map(Number);
        return <circle key="dot" cx={cx} cy={cy} r="2.2" className="hm-hero-dash-chart__dot" />;
      })}
    </svg>
  );
}

export function HomeHeroPortfolioDonutChart() {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 56 56" className="hm-hero-dash-chart__svg hm-hero-dash-chart__svg--donut" aria-hidden>
      <g transform="translate(28 28) rotate(-90)">
        <circle r={radius} className="hm-hero-dash-donut__track" />
        {HOME_HERO_DEMO.portfolioMix.map((seg) => {
          const dash = (seg.pct / 100) * circumference;
          const el = (
            <circle
              key={seg.label}
              r={radius}
              className="hm-hero-dash-donut__segment"
              stroke={seg.color}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </g>
    </svg>
  );
}

export function HomeHeroIncomeExpenseBars() {
  const rows = HOME_HERO_DEMO.incomeVsExpenses.slice(-4);
  const max = Math.max(...rows.flatMap((r) => [r.income, r.expenses]));

  return (
    <div className="hm-hero-dash-bars" aria-hidden>
      {rows.map((row) => (
        <div key={row.label} className="hm-hero-dash-bars__group">
          <div className="hm-hero-dash-bars__pair">
            <span
              className="hm-hero-dash-bars__bar hm-hero-dash-bars__bar--income"
              style={{ height: `${(row.income / max) * 100}%` }}
            />
            <span
              className="hm-hero-dash-bars__bar hm-hero-dash-bars__bar--expense"
              style={{ height: `${(row.expenses / max) * 100}%` }}
            />
          </div>
          <span className="hm-hero-dash-bars__label">{row.label}</span>
        </div>
      ))}
    </div>
  );
}
