import type { AppSectionTabItem } from "../../../components/ui/AppSectionTabs";

export const PROPERTY_WORKSPACE_OVERVIEW_TABS: Array<{ id: string; label: string; hrefSuffix?: string }> = [
  { id: "overview", label: "Overview" },
  { id: "financials", label: "Financials" },
  { id: "statement", label: "Statement" },
  { id: "tenants", label: "Tenants" },
  { id: "leases", label: "Leases" },
  { id: "invoices", label: "Invoices", hrefSuffix: "tab=financials&fin=invoice" },
  { id: "reports", label: "Reports" },
  { id: "documents", label: "Documents" },
  { id: "settings", label: "Settings", hrefSuffix: "edit" }
];

export function resolvePropertyWorkspaceActiveTabId(tab: string, finSub: string): string {
  if (tab === "financials" && finSub === "invoice") return "invoices";
  return tab;
}

export function buildPropertyOverviewTabItems(basePath: string): AppSectionTabItem[] {
  return PROPERTY_WORKSPACE_OVERVIEW_TABS.map((item) => {
    if (item.hrefSuffix === "edit") {
      return {
        id: item.id,
        label: item.label,
        href: `${basePath}/edit`
      };
    }
    if (item.hrefSuffix) {
      return {
        id: item.id,
        label: item.label,
        href: `${basePath}?${item.hrefSuffix}`
      };
    }
    const extra = item.id === "financials" ? "&fin=statement" : "";
    return {
      id: item.id,
      label: item.label,
      href: `${basePath}?tab=${encodeURIComponent(item.id)}${extra}`
    };
  });
}
