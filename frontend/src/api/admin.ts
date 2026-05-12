import { api, authHeader } from "./client";

export type PortfolioProjectionMetrics = {
  rentalIncomeGrowthPercentAnnual: number;
  totalExpensesGrowthPercentAnnual: number;
};

export async function fetchPortfolioProjectionMetrics() {
  const res = await api.get("/admin/portfolio-projection-metrics", { headers: authHeader() });
  return res.data as { metrics: PortfolioProjectionMetrics; description: string };
}

export async function patchPortfolioProjectionMetrics(patch: Partial<PortfolioProjectionMetrics>) {
  const res = await api.patch("/admin/portfolio-projection-metrics", patch, { headers: authHeader() });
  return res.data as { metrics: PortfolioProjectionMetrics };
}
