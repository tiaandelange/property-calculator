import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions
} from "chart.js";
import { getChartSemanticColors } from "../../theme/cssTokens";
import { buildPortfolioProjectionYears } from "./portfolioProjectionUtils";
import { fmtZarCompact } from "./portfolioDashboardUtils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function PortfolioSummaryProjectionChart({
  data,
  properties,
  propertyTypes,
  propertyId
}: {
  data: Record<string, unknown> | null | undefined;
  properties: Record<string, unknown>[];
  propertyTypes?: string[];
  propertyId?: string | number | null;
}) {
  const rows = useMemo(
    () =>
      buildPortfolioProjectionYears(data, properties, {
        propertyTypes: propertyTypes ?? [],
        propertyId: propertyId ?? null
      }),
    [data, properties, propertyTypes, propertyId]
  );

  const colors = getChartSemanticColors();
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
      labels: rows.map((r) => `Y${r.year}`),
      datasets: [
        {
          label: "Equity",
          data: rows.map((r) => r.equity),
          borderColor: colors.primary,
          backgroundColor: colors.fill,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "Cash flow",
          data: rows.map((r) => r.cashFlow),
          borderColor: colors.success,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "Income",
          data: rows.map((r) => r.income),
          borderColor: colors.info,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "Expenses",
          data: rows.map((r) => r.expenses),
          borderColor: colors.warning,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    }),
    [rows, colors]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 14,
            color: muted,
            font: { size: 11, weight: 600 }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return v == null ? "" : ` ${ctx.dataset.label}: ${fmtZarCompact(v)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
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
    <div className="pg-workspace-card pg-pdash-panel pg-pdash-analysis-panel">
      <div className="pg-pdash-panel-head">
        <h2 className="pg-pdash-panel-title">Summary</h2>
      </div>
      <div className="pg-pdash-chart-wrap pg-pdash-chart-wrap--projection">
        {rows.length ? <Line data={chartData} options={options} /> : <p className="pg-pdash-empty-inline">No projection data yet.</p>}
      </div>
    </div>
  );
}
