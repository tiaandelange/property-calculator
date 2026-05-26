import {
  Activity,
  AlertTriangle,
  BarChart3,
  CircleDollarSign,
  FileText,
  Home,
  Mail,
  Percent,
  Settings,
  Users,
  Wallet,
  Wrench,
  type LucideIcon
} from "lucide-react";
import type { IconContainerAccent } from "../components/ui/IconContainer";

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
  icon: LucideIcon;
  accent: IconContainerAccent;
};

export const dashboardStatIconByPreset: Record<DashboardStatIconPreset, DashboardStatIconConfig> = {
  "portfolio-value": { icon: Wallet, accent: "primary" },
  "monthly-income": { icon: CircleDollarSign, accent: "success" },
  "total-properties": { icon: Home, accent: "info" },
  occupancy: { icon: Activity, accent: "warning" },
  tenants: { icon: Users, accent: "success" },
  leases: { icon: FileText, accent: "primary" },
  maintenance: { icon: Wrench, accent: "info" },
  messages: { icon: Mail, accent: "neutral" },
  reports: { icon: BarChart3, accent: "info" },
  settings: { icon: Settings, accent: "neutral" },
  "cash-flow": { icon: CircleDollarSign, accent: "success" },
  "rent-due": { icon: AlertTriangle, accent: "danger" },
  vacancy: { icon: Home, accent: "warning" },
  deposits: { icon: Wallet, accent: "primary" },
  expenses: { icon: CircleDollarSign, accent: "warning" },
  yield: { icon: Percent, accent: "info" }
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

export function getDashboardStatIconConfig(
  preset: DashboardStatIconPreset
): DashboardStatIconConfig {
  return dashboardStatIconByPreset[preset];
}
