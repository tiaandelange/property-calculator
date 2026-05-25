import { assertSupabaseConfigured } from "../lib/supabaseClient";
import {
  getAdminStatus,
  getPortfolioProjectionMetrics,
  updatePortfolioProjectionMetrics,
  type PortfolioProjectionMetrics
} from "../services/adminSupabase";

export type { PortfolioProjectionMetrics };

export async function fetchAdminStatus() {
  assertSupabaseConfigured();
  return getAdminStatus();
}

export async function fetchPortfolioProjectionMetrics() {
  assertSupabaseConfigured();
  return getPortfolioProjectionMetrics();
}

export async function patchPortfolioProjectionMetrics(patch: Partial<PortfolioProjectionMetrics>) {
  assertSupabaseConfigured();
  return updatePortfolioProjectionMetrics(patch);
}
