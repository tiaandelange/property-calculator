type ChartLike = {
  chartType: string;
  title?: string;
  data?: {
    labels?: string[];
    datasets?: Array<Record<string, unknown>>;
  };
  options?: Record<string, unknown>;
};

const PRINCIPAL_STROKE = "#7C3AED";
const PRINCIPAL_FILL = "rgba(124, 58, 237, 0.35)";
const INTEREST_STROKE = "#C4B5FD";
const INTEREST_FILL = "rgba(196, 181, 253, 0.45)";
const PRIMARY_LINE = "#7C3AED";
const PRIMARY_FILL = "rgba(124, 58, 237, 0.22)";
const GRID_COLOR = "rgba(148, 163, 184, 0.22)";
const TICK_COLOR = "#64748B";

function isPrincipalInterestChart(chart: ChartLike): boolean {
  const datasets = chart.data?.datasets ?? [];
  const labels = datasets.map((d) => String(d.label ?? "").toLowerCase());
  return labels.some((l) => l.includes("principal")) && labels.some((l) => l.includes("interest"));
}

function themedDataset(label: string, data: unknown[], index: number) {
  const lower = label.toLowerCase();
  if (lower.includes("principal")) {
    return {
      label,
      data,
      borderColor: PRINCIPAL_STROKE,
      backgroundColor: PRINCIPAL_FILL,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      stack: "repayment"
    };
  }
  if (lower.includes("interest")) {
    return {
      label,
      data,
      borderColor: INTEREST_STROKE,
      backgroundColor: INTEREST_FILL,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      stack: "repayment"
    };
  }
  const palette = [PRIMARY_LINE, INTEREST_STROKE, "#94A3B8"];
  const color = palette[index % palette.length];
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color.includes("rgba") ? color : `${color}33`,
    fill: index === 0,
    tension: 0.25,
    pointRadius: 0
  };
}

function mergeChartScales(options: Record<string, unknown> | undefined): Record<string, unknown> {
  const scales = (options?.scales as Record<string, unknown> | undefined) ?? {};
  const mergeAxis = (axis: Record<string, unknown> | undefined) => ({
    ...(axis ?? {}),
    ticks: { color: TICK_COLOR, ...(axis?.ticks as object) },
    grid: { color: GRID_COLOR, ...(axis?.grid as object) }
  });
  return {
    ...(options ?? {}),
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      ...((options?.plugins as object) ?? {}),
      legend: {
        position: "top",
        align: "end",
        labels: { color: TICK_COLOR, boxWidth: 12, usePointStyle: true }
      }
    },
    scales: {
      ...scales,
      x: scales.x != null ? mergeAxis(scales.x as Record<string, unknown>) : { ticks: { color: TICK_COLOR }, grid: { display: false } },
      y: scales.y != null ? mergeAxis(scales.y as Record<string, unknown>) : { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } }
    }
  };
}

/** Frontend-only chart styling — does not alter calculation output values. */
export function applyProplyticChartTheme(chart: ChartLike, slug: string, graphTitle?: string): ChartLike {
  const datasets = chart.data?.datasets ?? [];
  const themedData = {
    labels: chart.data?.labels ?? [],
    datasets: datasets.map((ds, idx) =>
      themedDataset(String(ds.label ?? `Series ${idx + 1}`), (ds.data as unknown[]) ?? [], idx)
    )
  };

  if (slug === "monthly-payment" && chart.chartType === "bar" && isPrincipalInterestChart(chart)) {
    return {
      chartType: "line",
      title: graphTitle ?? "Repayment breakdown over time",
      data: themedData,
      options: mergeChartScales({
        ...chart.options,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true }
        }
      })
    };
  }

  if (chart.chartType === "line" || chart.chartType === "bar") {
    return {
      ...chart,
      title: graphTitle ?? chart.title,
      data: themedData,
      options: mergeChartScales(chart.options)
    };
  }

  if (chart.chartType === "doughnut") {
    return {
      ...chart,
      title: graphTitle ?? chart.title,
      data: {
        ...chart.data,
        datasets: datasets.map((ds, idx) => ({
          ...ds,
          backgroundColor: [PRINCIPAL_STROKE, INTEREST_STROKE, "#E2E8F0", "#94A3B8"].slice(0, ((ds.data as unknown[]) ?? []).length),
          borderWidth: 0
        }))
      },
      options: mergeChartScales(chart.options)
    };
  }

  return { ...chart, title: graphTitle ?? chart.title, options: mergeChartScales(chart.options) };
}
