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
const DOUGHNUT_PALETTE = [
  PRINCIPAL_STROKE,
  "#8B5CF6",
  "#A78BFA",
  "#C4B5FD",
  "#DDD6FE",
  INTEREST_STROKE,
  "#E2E8F0",
  "#94A3B8"
];

function isCashFlowBridgeChart(chart: ChartLike): boolean {
  const labels = chart.data?.labels ?? [];
  return labels.includes("Cash flow") && labels.includes("Income");
}

function cashFlowBridgeBarColors(chart: ChartLike): string[] {
  const datasets = chart.data?.datasets ?? [];
  const data = (datasets[0]?.data as number[]) ?? [];
  const net = data[data.length - 1] ?? 0;
  return ["#7C3AED", "#FB923C", "#F97316", "#6366F1", net >= 0 ? "#16A34A" : "#DC2626"];
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

function doughnutSliceColors(count: number): string[] {
  return DOUGHNUT_PALETTE.slice(0, Math.max(count, 1));
}

function isDualAxisComboChart(chart: ChartLike): boolean {
  if (chart.chartType !== "combo") return false;
  const scales = chart.options?.scales as Record<string, unknown> | undefined;
  if (scales?.y1 != null) return true;
  const datasets = chart.data?.datasets ?? [];
  return datasets.some((ds) => ds.yAxisID === "y1" || ds.type === "line");
}

function isPercentLineDataset(ds: Record<string, unknown>): boolean {
  const label = String(ds.label ?? "").toLowerCase();
  return (
    ds.type === "line" ||
    ds.yAxisID === "y1" ||
    label.includes("irr") ||
    label.includes("cash-on-cash") ||
    label.includes("%")
  );
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
      y: scales.y != null ? mergeAxis(scales.y as Record<string, unknown>) : { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } },
      y1: scales.y1 != null ? mergeAxis(scales.y1 as Record<string, unknown>) : scales.y1
    }
  };
}

function themedDoughnutOptions(existing?: Record<string, unknown>): Record<string, unknown> {
  const existingPlugins = (existing?.plugins as Record<string, unknown> | undefined) ?? {};
  const existingLegend = (existingPlugins.legend as Record<string, unknown> | undefined) ?? {};
  const existingTooltip = (existingPlugins.tooltip as Record<string, unknown> | undefined) ?? {};
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...existingPlugins,
      legend: {
        position: "right",
        align: "start",
        labels: {
          color: TICK_COLOR,
          boxWidth: 12,
          usePointStyle: true,
          padding: 10,
          ...((existingLegend.labels as object) ?? {})
        }
      },
      tooltip: {
        ...existingTooltip,
        callbacks: {
          label: (ctx: { label?: string; parsed?: number; dataset?: { data?: number[] } }) => {
            const value = typeof ctx.parsed === "number" ? ctx.parsed : 0;
            const total = (ctx.dataset?.data ?? []).reduce((sum, n) => sum + (Number(n) || 0), 0);
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
            return `${ctx.label ?? ""}: R ${value.toLocaleString("en-ZA")} (${pct}%)`;
          }
        }
      }
    }
  };
}

function themedDualAxisComboData(chart: ChartLike) {
  const datasets = chart.data?.datasets ?? [];
  return {
    labels: chart.data?.labels ?? [],
    datasets: datasets.map((ds) => {
      if (isPercentLineDataset(ds)) {
        return {
          ...ds,
          type: "line",
          borderColor: "#F59E0B",
          backgroundColor: "transparent",
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          yAxisID: "y1",
          spanGaps: false
        };
      }
      return {
        ...ds,
        type: "bar",
        backgroundColor: PRINCIPAL_FILL,
        borderColor: PRINCIPAL_STROKE,
        borderRadius: 6,
        borderSkipped: false,
        yAxisID: ds.yAxisID ?? "y"
      };
    })
  };
}

function formatDualAxisTick(value: string | number, axisTitle: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (/%|irr|cash-on-cash/i.test(axisTitle)) return `${n}%`;
  if (/zar|interest|principal|cash flow/i.test(axisTitle)) {
    if (Math.abs(n) >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `R ${Math.round(n / 1000)}k`;
    return `R ${Math.round(n)}`;
  }
  return String(n);
}

function themedDualAxisComboOptions(chart: ChartLike): Record<string, unknown> {
  const chartOpts = chart.options ?? {};
  const scales = (chartOpts.scales as Record<string, Record<string, unknown>> | undefined) ?? {};
  const yTitle = (scales.y?.title as { text?: string } | undefined)?.text ?? "Cash flow (ZAR)";
  const rightAxisTitle = (scales.y1?.title as { text?: string } | undefined)?.text ?? "Rate (%)";
  const existingYTicks = (scales.y?.ticks as Record<string, unknown> | undefined) ?? {};
  const existingY1Ticks = (scales.y1?.ticks as Record<string, unknown> | undefined) ?? {};
  const currencyAxis = (title: string) => /zar|interest|principal|cash flow/i.test(title);

  const merged = mergeChartScales({
    ...chartOpts,
    scales: {
      x: { grid: { display: false }, ...(scales.x ?? {}) },
      y: {
        ...(scales.y ?? {}),
        position: "left",
        title: {
          display: true,
          text: yTitle,
          color: TICK_COLOR,
          font: { size: 11, weight: 600 },
          ...((scales.y?.title as object) ?? {})
        },
        ticks: {
          color: TICK_COLOR,
          ...existingYTicks,
          callback:
            (existingYTicks.callback as ((value: string | number) => string) | undefined) ??
            (currencyAxis(yTitle)
              ? (value: string | number) => formatDualAxisTick(value, yTitle)
              : undefined)
        }
      },
      y1: {
        ...(scales.y1 ?? {}),
        position: "right",
        title: {
          display: true,
          text: rightAxisTitle,
          color: TICK_COLOR,
          font: { size: 11, weight: 600 },
          ...((scales.y1?.title as object) ?? {})
        },
        grid: { drawOnChartArea: false, ...((scales.y1?.grid as object) ?? {}) },
        ticks: {
          color: TICK_COLOR,
          ...existingY1Ticks,
          callback:
            (existingY1Ticks.callback as ((value: string | number) => string) | undefined) ??
            ((value: string | number) => formatDualAxisTick(value, rightAxisTitle))
        }
      }
    }
  });

  const plugins = (merged.plugins as Record<string, unknown> | undefined) ?? {};
  const legend = (plugins.legend as Record<string, unknown> | undefined) ?? {};
  return {
    ...merged,
    plugins: {
      ...plugins,
      legend: {
        ...legend,
        position: "top",
        align: "center",
        labels: {
          color: TICK_COLOR,
          boxWidth: 12,
          usePointStyle: true,
          padding: 16,
          ...((legend.labels as object) ?? {})
        }
      }
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

  if (slug === "cash-flow" && chart.chartType === "bar" && isCashFlowBridgeChart(chart)) {
    const bridgeColors = cashFlowBridgeBarColors(chart);
    return {
      ...chart,
      title: graphTitle ?? "Cash flow breakdown",
      data: {
        labels: chart.data?.labels ?? [],
        datasets: datasets.map((ds) => ({
          ...ds,
          backgroundColor: bridgeColors,
          borderRadius: 6,
          borderSkipped: false
        }))
      },
      options: mergeChartScales({
        ...chart.options,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: false }
        }
      })
    };
  }

  if (isDualAxisComboChart(chart)) {
    return {
      ...chart,
      title: graphTitle ?? chart.title,
      data: themedDualAxisComboData(chart),
      options: themedDualAxisComboOptions(chart)
    };
  }

  if (chart.chartType === "doughnut") {
    const sliceCount = ((datasets[0]?.data as unknown[]) ?? []).length;
    return {
      ...chart,
      title: graphTitle ?? chart.title,
      data: {
        labels: chart.data?.labels ?? [],
        datasets: datasets.map((ds) => ({
          ...ds,
          backgroundColor: doughnutSliceColors(sliceCount),
          borderWidth: 0
        }))
      },
      options: themedDoughnutOptions(chart.options)
    };
  }

  if (chart.chartType === "line" || chart.chartType === "bar" || chart.chartType === "combo") {
    return {
      ...chart,
      title: graphTitle ?? chart.title,
      data: themedData,
      options: mergeChartScales(chart.options)
    };
  }

  return { ...chart, title: graphTitle ?? chart.title, options: mergeChartScales(chart.options) };
}

/** Whether a chart uses the dual-axis combo layout (for responsive legend tweaks). */
export function isDualAxisComboChartType(chart: ChartLike): boolean {
  return isDualAxisComboChart(chart);
}
