export type Money = number; // ZAR numeric
export type Percent = number; // percent 0-100

export type MetricUnit = "currency" | "percent" | "number";

export type SummaryMetric = {
  key: string;
  label: string;
  unit: MetricUnit;
  value: number | null;
  formatted: string;
};

export type ChartType = "line" | "bar" | "doughnut" | "combo";

export type ChartData = {
  chartType: ChartType;
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      type?: "bar" | "line";
      label: string;
      data: Array<number | null>;
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      stack?: string;
      yAxisID?: string;
      tension?: number;
      pointRadius?: number;
      spanGaps?: boolean;
    }>;
  };
  options?: Record<string, unknown>;
};

export type CalculatorInterpretation = {
  text: string;
  classification?: "weak" | "tight" | "acceptable" | "strong" | "very-strong";
  warnings: string[];
};

export type CalculatorResult = {
  calculator: string;
  scenarioName?: string;
  summary: SummaryMetric[];
  breakdown: Record<string, unknown>;
  interpretation: CalculatorInterpretation;
  chartData: ChartData[];
  assumptionsUsed: Record<string, unknown>;
};

