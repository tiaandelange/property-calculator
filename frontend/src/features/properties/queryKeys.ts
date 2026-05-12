/** Logical cache keys when migrating to TanStack Query later. */
export const propertyQueryKeys = {
  aggregate: (id: string | number) => ["property", id, "aggregate"] as const,
  dashboardSummary: (month?: string | null, propertyId?: number | null) =>
    ["portfolio", "dashboard-summary", month ?? "current", propertyId ?? "all"] as const,
  propertiesList: (month?: string | null) => ["properties", "list", month ?? "current"] as const
};
