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
import {
  buildPortfolioProjectionYears,
  pickPortfolioProjectionDisplayYears
} from "./portfolioProjectionUtils";
import { fmtZarCompact } from "./portfolioDashboardUtils";
import { useSettingsQuery, useWorkspaceId } from "../queries";

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
  const workspaceId = useWorkspaceId();
  const settingsQuery = useSettingsQuery();
  const growth = settingsQuery.data
    ? {
        incomeGrowthPct: settingsQuery.data.annualIncomeGrowthPercentAnnual,
        expenseGrowthPct: settingsQuery.data.expenseGrowthPercentAnnual,
        appreciationPct: settingsQuery.data.propertyAppreciationPercentAnnual
      }
    : null;

  const rows = useMemo(() => {
    const allYears = buildPortfolioProjectionYears(data, properties, {
      propertyTypes: propertyTypes ?? [],
      propertyId: propertyId ?? null,
      growth
    });
    return pickPortfolioProjectionDisplayYears(allYears);
  }, [data, properties, propertyTypes, propertyId, growth, workspaceId, settingsQuery.data]);

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
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          yAxisID: "y"
        },
        {
          label: "Cash flow",
          data: rows.map((r) => r.cashFlow),
          borderColor: colors.success,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          yAxisID: "y1"
        },
        {
          label: "Income",
          data: rows.map((r) => r.income),
          borderColor: colors.info,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          yAxisID: "y1"
        },
        {
          label: "Expenses",
          data: rows.map((r) => r.expenses),
          borderColor: colors.warning,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          yAxisID: "y1"
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
          ticks: { color: muted, maxRotation: 0, autoSkip: false }
        },
        y: {
          type: "linear",
          position: "left",
          title: {
            display: true,
            text: "Equity",
            color: muted,
            font: { size: 11, weight: 600 }
          },
          grid: { color: gridColor },
          ticks: {
            color: muted,
            callback: (v) => fmtZarCompact(Number(v))
          }
        },
        y1: {
          type: "linear",
          position: "right",
          title: {
            display: true,
            text: "Income / expenses / cash flow",
            color: muted,
            font: { size: 11, weight: 600 }
          },
          grid: { drawOnChartArea: false },
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
        {rows.length ? (
          <Line data={chartData} options={options} />
        ) : (
          <p className="pg-pdash-empty-inline">No projection data yet.</p>
        )}
      </div>
      {rows.length > 0 ? (
        <p className="pg-pdash-chart-note">
          Equity uses the left axis; income, expenses, and cash flow use the right axis.
        </p>
      ) : null}
    </div>
  );
}
