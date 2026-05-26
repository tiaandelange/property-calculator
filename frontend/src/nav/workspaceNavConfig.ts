import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calculator,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";

export type WorkspaceNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  disabled?: boolean;
  /** When true, item appears in mobile bottom nav */
  bottomNav?: boolean;
};

export const WORKSPACE_SIDEBAR_NAV: WorkspaceNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/owned-properties/dashboard", bottomNav: true },
  { id: "properties", label: "Properties", icon: Home, to: "/owned-properties/my-properties", bottomNav: true },
  { id: "tenants", label: "Tenants", icon: Users, to: "/tenants", bottomNav: true },
  { id: "leases", label: "Leases", icon: FileText, to: "/leases", bottomNav: true },
  { id: "financials", label: "Financials", icon: CreditCard, to: "/financials" },
  { id: "reports", label: "Reports", icon: BarChart3, to: "/owned-properties/reports" },
  { id: "messages", label: "Messages", icon: MessageSquare, disabled: true },
  { id: "settings", label: "Settings", icon: Settings, to: "/settings", bottomNav: true },
  { id: "calculators", label: "Calculators", icon: Calculator, disabled: true }
];

export const WORKSPACE_MOBILE_BOTTOM_NAV = WORKSPACE_SIDEBAR_NAV.filter((item) => item.bottomNav && item.to);

export function isWorkspaceNavActive(pathname: string, item: WorkspaceNavItem): boolean {
  if (!item.to) return false;
  if (item.id === "dashboard") {
    return pathname === "/owned-properties/dashboard" || pathname === "/dashboard";
  }
  if (item.id === "properties") {
    return (
      pathname.startsWith("/owned-properties") &&
      !pathname.startsWith("/owned-properties/dashboard") &&
      !pathname.includes("/reports")
    );
  }
  if (item.id === "financials") {
    return pathname.startsWith("/financials") || pathname.startsWith("/invoices");
  }
  if (item.id === "reports") {
    return pathname.includes("/owned-properties/reports");
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function workspacePageTitle(pathname: string): string {
  if (pathname === "/owned-properties/dashboard" || pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/owned-properties/my-properties") || pathname === "/owned-properties/new") return "Properties";
  if (pathname.startsWith("/owned-properties/") && !pathname.includes("/reports")) return "Properties";
  if (pathname.startsWith("/tenants")) return "Tenants";
  if (pathname.startsWith("/leases")) return "Leases";
  if (pathname.startsWith("/financials") || pathname.startsWith("/invoices")) return "Financials";
  if (pathname.includes("/owned-properties/reports")) return "Reports";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/subscription")) return "Subscription";
  if (pathname === "/admin") return "Admin";
  return "Dashboard";
}
