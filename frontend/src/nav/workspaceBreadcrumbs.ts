import type { PageBreadcrumbItem } from "../components/nav/PageBreadcrumb";

export const PG_HOME: PageBreadcrumbItem = { label: "Home", to: "/" };
export const PG_WORKSPACE_DASH: PageBreadcrumbItem = { label: "Dashboard", to: "/owned-properties/dashboard" };
export const PG_MY_PROPERTIES: PageBreadcrumbItem = { label: "My Properties", to: "/owned-properties/my-properties" };
export const PG_TENANTS: PageBreadcrumbItem = { label: "Tenants", to: "/tenants" };
export const PG_CALCULATORS: PageBreadcrumbItem = { label: "Calculators", to: "/calculators" };

/** Workspace sidebar context: dashboard link + current page label (last segment, no `to`). */
export function workspacePage(endLabel: string): PageBreadcrumbItem[] {
  return [PG_WORKSPACE_DASH, { label: endLabel }];
}

export function workspaceMyProperties(endLabel: string): PageBreadcrumbItem[] {
  return [PG_WORKSPACE_DASH, PG_MY_PROPERTIES, { label: endLabel }];
}

export function workspaceTenants(endLabel: string): PageBreadcrumbItem[] {
  return [PG_WORKSPACE_DASH, PG_TENANTS, { label: endLabel }];
}

export function homeThen(endLabel: string): PageBreadcrumbItem[] {
  return [PG_HOME, { label: endLabel }];
}

/** Calculator hub (last = Calculators) or a specific calculator (last = name). */
export function calculatorsTrail(calculatorName?: string): PageBreadcrumbItem[] {
  if (!calculatorName) return [PG_HOME, { label: "Calculators" }];
  return [PG_HOME, PG_CALCULATORS, { label: calculatorName }];
}
