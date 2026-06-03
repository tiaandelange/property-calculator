import type { IconName } from "../components/icons/iconRegistry";
import { INVESTMENT_CALCULATOR_PATH } from "../constants/investmentCalculatorPath";

export type WorkspaceNavItem = {
  id: string;
  label: string;
  icon: IconName;
  to?: string;
  disabled?: boolean;
  /** When true, item appears in mobile bottom nav */
  bottomNav?: boolean;
};

export const WORKSPACE_SIDEBAR_NAV: WorkspaceNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", to: "/owned-properties/dashboard", bottomNav: true },
  { id: "properties", label: "Properties", icon: "properties", to: "/owned-properties/my-properties", bottomNav: true },
  { id: "tenants", label: "Tenants", icon: "tenants", to: "/tenants", bottomNav: true },
  { id: "leases", label: "Leases", icon: "leases", to: "/leases", bottomNav: true },
  { id: "invoices", label: "Invoices", icon: "invoices", to: "/invoices" },
  { id: "financials", label: "Financials", icon: "financials", to: "/financials" },
  { id: "documents", label: "Documents", icon: "documents", to: "/documents" },
  { id: "reports", label: "Reports", icon: "reports", to: "/owned-properties/reports" },
  { id: "calculators", label: "Calculators", icon: "calculators", to: INVESTMENT_CALCULATOR_PATH },
  { id: "messages", label: "Messages", icon: "messages", disabled: true },
  { id: "settings", label: "Settings", icon: "settings", to: "/settings", bottomNav: true },
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
    return pathname.startsWith("/financials");
  }
  if (item.id === "invoices") {
    return pathname === "/invoices" || pathname.startsWith("/invoices/");
  }
  if (item.id === "reports") {
    return pathname.includes("/owned-properties/reports");
  }
  if (item.id === "calculators") {
    return pathname === INVESTMENT_CALCULATOR_PATH;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function workspacePageTitle(pathname: string): string {
  if (pathname === "/owned-properties/dashboard" || pathname === "/dashboard") return "Dashboard";
  if (pathname === "/owned-properties/new") return "Create property";
  if (/^\/owned-properties\/[^/]+\/edit$/.test(pathname)) return "Edit property";
  if (pathname.startsWith("/owned-properties/my-properties")) return "Properties";
  if (pathname.startsWith("/owned-properties/") && !pathname.includes("/reports")) return "Properties";
  if (pathname.startsWith("/tenants")) return "Tenants";
  if (pathname.startsWith("/leases")) return "Leases";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/financials")) return "Financials";
  if (pathname.includes("/owned-properties/reports")) return "Reports";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname === INVESTMENT_CALCULATOR_PATH) return "Calculators";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/account")) return "Settings";
  if (pathname.startsWith("/subscription")) return "Subscription";
  if (pathname === "/admin") return "Admin";
  return "Dashboard";
}
