import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions
} from "chart.js";
import { getCssToken } from "../../theme/cssTokens";
import {
  buildPortfolioChartPoints,
  fmtZarCompact,
  type PortfolioChartRange
} from "./portfolioDashboardUtils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const RANGE_OPTIONS: { value: PortfolioChartRange; label: string }[] = [
  { value: "THIS_YEAR", label: "This Year" },
  { value: "LAST_6", label: "Last 6 Months" },
  { value: "LAST_12", label: "Last 12 Months" },
  { value: "ALL", label: "All Time" }
];

export function PortfolioOverviewChart({
  data,
  range,
  onRangeChange
}: {
  data: Record<string, unknown> | null | undefined;
  range: PortfolioChartRange;
  onRangeChange: (r: PortfolioChartRange) => void;
}) {
  const { points, estimated } = useMemo(() => buildPortfolioChartPoints(data, range), [data, range]);

  const lineColor = getCssToken("--chart-line", "#7c5cff");
  const fillColor = getCssToken("--chart-fill", "rgba(124, 92, 255, 0.22)");
  const gridColor =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--dash-border").trim() ||
        "rgba(255,255,255,0.08)"
      : "rgba(255,255,255,0.08)";
  const muted =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--dash-text-secondary").trim() ||
        "#a1a8b3"
      : "#a1a8b3";

  const chartData = useMemo(
    () => ({
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: "Portfolio cash flow",
          data: points.map((p) => p.value),
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2
        }
      ]
    }),
    [points, lineColor, fillColor]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return v == null ? "" : fmtZarCompact(v);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: muted,
            callback: (v) => fmtZarCompact(Number(v))
          }
        }
      }
    }),
    [gridColor, muted]
  );

  return (
    <div className="pg-workspace-card pg-pdash-panel pg-pdash-chart-panel">
      <div className="pg-pdash-panel-head">
        <h2 className="pg-pdash-panel-title">Portfolio Overview</h2>
        <select
          className="pg-pdash-select"
          value={range}
          onChange={(e) => onRangeChange(e.target.value as PortfolioChartRange)}
          aria-label="Chart time range"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="pg-pdash-chart-wrap">
        {points.length ? <Line data={chartData} options={options} /> : <p className="pg-pdash-empty-inline">No chart data yet.</p>}
      </div>
      {estimated ? (
        <p className="pg-pdash-chart-note">Illustrative trend from current totals and admin growth defaults — not stored.</p>
      ) : null}
    </div>
  );
}
