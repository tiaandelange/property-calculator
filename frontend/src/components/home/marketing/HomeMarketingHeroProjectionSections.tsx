import {
  formatHeroProjectionCell,
  homepageHeroProjectionPreview
} from "../../../data/homepagePreviewContent";

const CHART_COLORS = {
  equity: "var(--primary)",
  cashFlow: "var(--success)",
  income: "var(--info)",
  expenses: "var(--warning)"
} as const;

function normalizeSeries(values: readonly number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v) => (v - min) / span);
}

function polyline(
  normalized: number[],
  width: number,
  height: number,
  padX: number,
  padY: number
): string {
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  return normalized
    .map((t, i) => {
      const x = padX + (i / Math.max(normalized.length - 1, 1)) * innerW;
      const y = padY + (1 - t) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Static Detailed Overview + Summary chart (portfolio dashboard layout, illustrative data). */
export function HomeMarketingHeroProjectionSections() {
  const preview = homepageHeroProjectionPreview;
  const labels = preview.years.map((y) => `Y${y}`);

  const equityNorm = normalizeSeries(preview.metrics.find((m) => m.key === "equity")!.values);
  const cashNorm = normalizeSeries(preview.metrics.find((m) => m.key === "cashFlow")!.values);
  const incomeNorm = normalizeSeries(preview.metrics.find((m) => m.key === "income")!.values);
  const expenseNorm = normalizeSeries(preview.metrics.find((m) => m.key === "expenses")!.values);

  const w = 320;
  const h = 120;
  const pad = 8;

  return (
    <div className="hm-app-preview__analysis" aria-hidden>
      <div className="pg-workspace-card pg-pdash-panel pg-pdash-analysis-panel hm-app-preview__pdash-panel">
        <div className="pg-pdash-panel-head">
          <h2 className="pg-pdash-panel-title">Detailed Overview</h2>
          <span className="hm-app-preview__panel-meta">{preview.propertyName}</span>
        </div>
        <div className="pg-pdash-projection-table-wrap">
          <table className="pg-pdash-projection-table pg-pdash-projection-table--transposed">
            <thead>
              <tr>
                <th scope="col" className="pg-pdash-projection-table-corner" />
                {preview.years.map((year) => (
                  <th key={year} scope="col">
                    Y{year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.metrics.map((metric) => (
                <tr key={metric.key}>
                  <th scope="row">{metric.label}</th>
                  {metric.values.map((value, index) => (
                    <td key={`${metric.key}-${preview.years[index]}`}>
                      {formatHeroProjectionCell(metric.format, value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pg-workspace-card pg-pdash-panel pg-pdash-analysis-panel hm-app-preview__pdash-panel">
        <div className="pg-pdash-panel-head">
          <h2 className="pg-pdash-panel-title">Summary</h2>
        </div>
        <div className="pg-pdash-chart-wrap pg-pdash-chart-wrap--projection hm-app-preview__projection-chart-wrap">
          <svg
            className="hm-app-preview__projection-chart-svg"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Projection summary chart for equity, cash flow, income and expenses"
          >
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1={pad}
                x2={w - pad}
                y1={pad + g * (h - pad * 2)}
                y2={pad + g * (h - pad * 2)}
                stroke="var(--border-soft)"
                strokeWidth="1"
              />
            ))}
            <polyline
              fill="none"
              stroke={CHART_COLORS.equity}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline(equityNorm, w, h, pad, pad)}
            />
            <polyline
              fill="none"
              stroke={CHART_COLORS.cashFlow}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline(cashNorm, w, h, pad, pad)}
            />
            <polyline
              fill="none"
              stroke={CHART_COLORS.income}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline(incomeNorm, w, h, pad, pad)}
            />
            <polyline
              fill="none"
              stroke={CHART_COLORS.expenses}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline(expenseNorm, w, h, pad, pad)}
            />
          </svg>
          <div className="hm-app-preview__projection-chart-axis">
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <ul className="hm-app-preview__projection-legend">
          <li>
            <span className="hm-app-preview__projection-legend-swatch" style={{ background: CHART_COLORS.equity }} />
            Equity
          </li>
          <li>
            <span className="hm-app-preview__projection-legend-swatch" style={{ background: CHART_COLORS.cashFlow }} />
            Cash flow
          </li>
          <li>
            <span className="hm-app-preview__projection-legend-swatch" style={{ background: CHART_COLORS.income }} />
            Income
          </li>
          <li>
            <span className="hm-app-preview__projection-legend-swatch" style={{ background: CHART_COLORS.expenses }} />
            Expenses
          </li>
        </ul>
        <p className="pg-pdash-chart-note hm-app-preview__projection-note">{preview.chartNote}</p>
      </div>
    </div>
  );
}
