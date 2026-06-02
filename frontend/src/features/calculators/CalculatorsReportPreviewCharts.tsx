import { useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions
} from "chart.js";
import { getChartSemanticColors } from "../../theme/cssTokens";
import type { NormalizedCalcResult } from "./propertyTypeCalculations";

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip, PointElement, LineElement);

function cssToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function IncomeVsExpensesChart({ metrics }: { metrics: NormalizedCalcResult | null }) {
  const colors = getChartSemanticColors();
  const gridColor = cssToken("--dash-border", "rgba(148,163,184,0.22)");
  const muted = cssToken("--text-muted", colors.muted);

  const income = metrics?.monthlyIncome ?? null;
  const expenses = metrics?.monthlyExpenses ?? null;
  const hasData = income != null || expenses != null;

  const data = useMemo(
    () => ({
      labels: ["Monthly"],
      datasets: [
        {
          label: "Income",
          data: [income ?? 0],
          backgroundColor: colors.successSoft,
          borderColor: colors.success,
          borderWidth: 1.5,
          borderRadius: 10
        },
        {
          label: "Expenses",
          data: [expenses ?? 0],
          backgroundColor: colors.dangerSoft,
          borderColor: colors.danger,
          borderWidth: 1.5,
          borderRadius: 10
        }
      ]
    }),
    [income, expenses, colors]
  );

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { boxWidth: 12, padding: 14, color: muted, font: { size: 11, weight: 600 } }
        },
        tooltip: { enabled: hasData }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: muted } },
        y: {
          grid: { color: gridColor },
          ticks: { color: muted, callback: (v) => `R ${Number(v).toLocaleString("en-ZA")}` }
        }
      }
    }),
    [gridColor, muted, hasData]
  );

  return (
    <div className="pg-calculators-chart-wrap">
      <div className="pg-calculator-chart-host">
        <Bar data={data} options={options} />
      </div>
      {!hasData ? <div className="pg-calculators-chart-empty">Add inputs to see the chart.</div> : null}
    </div>
  );
}

export function CashFlowTrendChart({ metrics }: { metrics: NormalizedCalcResult | null }) {
  const colors = getChartSemanticColors();
  const gridColor = cssToken("--dash-border", "rgba(148,163,184,0.22)");
  const muted = cssToken("--text-muted", colors.muted);

  const cashFlow = metrics?.projectedCashFlow ?? null;
  const hasData = cashFlow != null;

  const labels = useMemo(() => ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"], []);
  const series = useMemo(() => labels.map((_, i) => (cashFlow == null ? 0 : cashFlow * (1 + i * 0.0))), [labels, cashFlow]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Projected cash flow",
          data: series,
          borderColor: cashFlow != null && cashFlow < 0 ? colors.danger : colors.primary,
          backgroundColor: colors.fill,
          tension: 0.28,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    }),
    [labels, series, colors, cashFlow]
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
          labels: { boxWidth: 12, padding: 14, color: muted, font: { size: 11, weight: 600 } }
        },
        tooltip: { enabled: hasData }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: muted } },
        y: {
          grid: { color: gridColor },
          ticks: { color: muted, callback: (v) => `R ${Number(v).toLocaleString("en-ZA")}` }
        }
      }
    }),
    [gridColor, muted, hasData]
  );

  return (
    <div className="pg-calculators-chart-wrap">
      <div className="pg-calculator-chart-host">
        <Line data={data} options={options} />
      </div>
      {!hasData ? <div className="pg-calculators-chart-empty">Add inputs to see the trend.</div> : null}
    </div>
  );
}

