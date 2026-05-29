import type { IconContainerAccent } from "../components/icons/IconContainer";
import { getIconComponent, type IconName } from "../components/icons/iconRegistry";

export type DashboardStatIconPreset =
  | "portfolio-value"
  | "monthly-income"
  | "total-properties"
  | "occupancy"
  | "tenants"
  | "leases"
  | "maintenance"
  | "messages"
  | "reports"
  | "settings"
  | "cash-flow"
  | "rent-due"
  | "vacancy"
  | "deposits"
  | "expenses"
  | "yield";

export type DashboardStatIconConfig = {
  icon: IconName;
  accent: IconContainerAccent;
};

export const dashboardStatIconByPreset: Record<DashboardStatIconPreset, DashboardStatIconConfig> = {
  "portfolio-value": { icon: "wallet", accent: "primary" },
  "monthly-income": { icon: "rent", accent: "success" },
  "total-properties": { icon: "properties", accent: "info" },
  occupancy: { icon: "activity", accent: "warning" },
  tenants: { icon: "tenants", accent: "success" },
  leases: { icon: "leases", accent: "primary" },
  maintenance: { icon: "maintenance", accent: "info" },
  messages: { icon: "messages", accent: "neutral" },
  reports: { icon: "reports", accent: "info" },
  settings: { icon: "settings", accent: "neutral" },
  "cash-flow": { icon: "rent", accent: "success" },
  "rent-due": { icon: "warning", accent: "danger" },
  vacancy: { icon: "properties", accent: "warning" },
  deposits: { icon: "wallet", accent: "primary" },
  expenses: { icon: "rent", accent: "warning" },
  yield: { icon: "percent", accent: "info" }
};

/** Infer a preset from common dashboard stat / metric titles. */
export function inferDashboardStatIconPreset(title: string): DashboardStatIconPreset | undefined {
  const t = title.toLowerCase();
  if (t.includes("equity") || t.includes("net worth") || t.includes("portfolio value")) return "portfolio-value";
  if (t.includes("rent roll") || t.includes("monthly income") || t.includes("monthly rent")) return "monthly-income";
  if (t.includes("total propert")) return "total-properties";
  if (t.includes("occupied") || t.includes("occupancy")) return "occupancy";
  if (t.includes("tenant")) return "tenants";
  if (t.includes("lease")) return "leases";
  if (t.includes("maintenance")) return "maintenance";
  if (t.includes("message") || t.includes("lead")) return "messages";
  if (t.includes("report")) return "reports";
  if (t.includes("cash flow")) return "cash-flow";
  if (t.includes("rent due") || t.includes("overdue")) return "rent-due";
  if (t.includes("vacan")) return "vacancy";
  if (t.includes("deposit")) return "deposits";
  if (t.includes("expense")) return "expenses";
  if (t.includes("yield")) return "yield";
  return undefined;
}

export function getDashboardStatIconConfig(preset: DashboardStatIconPreset): DashboardStatIconConfig {
  return dashboardStatIconByPreset[preset];
}

/** Resolve preset config to a Lucide component (for legacy callers). */
export function getDashboardStatLucideIcon(preset: DashboardStatIconPreset) {
  const { icon } = getDashboardStatIconConfig(preset);
  return getIconComponent(icon);
}
