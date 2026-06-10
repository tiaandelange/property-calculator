/** Static demo data for the public homepage hero dashboard mockup only. */

export const HOME_HERO_DEMO = {
  propertyCount: 12,
  portfolioValue: "R 8.45M",
  totalEquity: "R 4.82M",
  monthlyCashFlow: "R 41,200",
  occupancy: "96%",
  averageYield: "8.7%",
  period: "This Month",
  cashFlowTrend: [
    { label: "Jan", value: 22 },
    { label: "Feb", value: 28 },
    { label: "Mar", value: 25 },
    { label: "Apr", value: 36 },
    { label: "May", value: 31 },
    { label: "Jun", value: 41.2 }
  ] as const,
  incomeVsExpenses: [
    { label: "Jan", income: 62, expenses: 38 },
    { label: "Feb", income: 66, expenses: 40 },
    { label: "Mar", income: 72, expenses: 42 },
    { label: "Apr", income: 78, expenses: 44 },
    { label: "May", income: 81, expenses: 46 },
    { label: "Jun", income: 86, expenses: 45 }
  ] as const,
  portfolioMix: [
    { label: "Residential", pct: 72, color: "#7c3aed" },
    { label: "Commercial", pct: 18, color: "#6366f1" },
    { label: "Industrial", pct: 6, color: "#94a3b8" },
    { label: "Other", pct: 4, color: "#cbd5e1" }
  ] as const,
  topProperties: [
    { name: "Greenwood Villas", type: "Residential", cashFlow: "R 12,150", yield: "9.1%", occupancy: "100%", value: "R 2.35M" },
    { name: "Ocean View Apartments", type: "Residential", cashFlow: "R 9,420", yield: "8.6%", occupancy: "95%", value: "R 1.98M" },
    { name: "Parkline Industrial", type: "Commercial", cashFlow: "R 7,950", yield: "8.2%", occupancy: "93%", value: "R 1.85M" },
    { name: "Riverside Office", type: "Commercial", cashFlow: "R 6,980", yield: "8.9%", occupancy: "100%", value: "R 1.42M" }
  ] as const,
  leaseExpiries: { count: 3, window: "90 days" }
} as const;

export const HOME_HERO_DASHBOARD_KPIS = [
  { key: "equity", label: "Total Equity", value: HOME_HERO_DEMO.totalEquity, icon: "portfolio" as const },
  { key: "cashFlow", label: "Net Cash Flow", value: HOME_HERO_DEMO.monthlyCashFlow, icon: "wallet" as const },
  { key: "occupancy", label: "Occupancy", value: HOME_HERO_DEMO.occupancy, icon: "leases" as const },
  { key: "yield", label: "Avg Yield", value: HOME_HERO_DEMO.averageYield, icon: "percent" as const },
  { key: "value", label: "Portfolio Value", value: HOME_HERO_DEMO.portfolioValue, icon: "activity" as const, highlight: true }
] as const;

export const HOME_HERO_FLOATING_ICONS = [
  { icon: "property" as const, placement: "icon-a" as const, delay: 0.2, faded: false },
  { icon: "reports" as const, placement: "icon-b" as const, delay: 1, faded: true },
  { icon: "calculators" as const, placement: "icon-c" as const, delay: 0.6, faded: false },
  { icon: "activity" as const, placement: "icon-d" as const, delay: 1.4, faded: true },
  { icon: "percent" as const, placement: "icon-e" as const, delay: 0.9, faded: false },
  { icon: "wallet" as const, placement: "icon-f" as const, delay: 1.8, faded: true }
] as const;

export const HOME_HERO_SIDEBAR_NAV = [
  { icon: "dashboard" as const, label: "Dashboard", active: true },
  { icon: "properties" as const, label: "Properties" },
  { icon: "tenants" as const, label: "Tenants" },
  { icon: "leases" as const, label: "Leases" },
  { icon: "reports" as const, label: "Reports" },
  { icon: "maintenance" as const, label: "Maintenance" },
  { icon: "documents" as const, label: "Documents" },
  { icon: "settings" as const, label: "Settings" }
] as const;
