import { api, authHeader } from "./client";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import {
  getAdminStatus,
  getPortfolioProjectionMetrics,
  updatePortfolioProjectionMetrics,
  type PortfolioProjectionMetrics
} from "../services/adminSupabase";

export type { PortfolioProjectionMetrics };

export async function fetchAdminStatus() {
  if (!isSupabaseConfigured) {
    const res = await api.get("/admin/status", { headers: authHeader() });
    return res.data as { message: string };
  }
  return getAdminStatus();
}

export async function fetchPortfolioProjectionMetrics() {
  if (!isSupabaseConfigured) {
    const res = await api.get("/admin/portfolio-projection-metrics", { headers: authHeader() });
    return res.data as { metrics: PortfolioProjectionMetrics; description: string };
  }
  return getPortfolioProjectionMetrics();
}

export async function patchPortfolioProjectionMetrics(patch: Partial<PortfolioProjectionMetrics>) {
  if (!isSupabaseConfigured) {
    const res = await api.patch("/admin/portfolio-projection-metrics", patch, { headers: authHeader() });
    return res.data as { metrics: PortfolioProjectionMetrics };
  }
  return updatePortfolioProjectionMetrics(patch);
}
