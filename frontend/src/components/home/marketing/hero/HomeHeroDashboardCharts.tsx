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
