import type { IconName } from "../components/icons/iconRegistry";

export type ReportsHubCategoryId =
  | "all"
  | "portfolio"
  | "property-analysis"
  | "cash-flow"
  | "tenant-admin"
  | "invoices"
  | "statements";

export type ReportsHubDirectoryItem = {
  id: string;
  title: string;
  description: string;
  /** Shorter copy for mobile cards and search. */
  descriptionMobile: string;
  usefulFor: string;
  icon: IconName;
  categories: Exclude<ReportsHubCategoryId, "all">[];
};

export const REPORTS_HUB_CATEGORIES: Array<{
  id: ReportsHubCategoryId;
  label: string;
  icon: IconName;
}> = [
  { id: "all", label: "All", icon: "reports" },
  { id: "portfolio", label: "Portfolio", icon: "portfolio" },
  { id: "property-analysis", label: "Property Analysis", icon: "property" },
  { id: "cash-flow", label: "Cash Flow", icon: "wallet" },
  { id: "tenant-admin", label: "Tenant Admin", icon: "tenants" },
  { id: "invoices", label: "Invoices", icon: "invoices" },
  { id: "statements", label: "Statements", icon: "statements" }
];

export const reportsHubDirectoryItems: ReportsHubDirectoryItem[] = [
  {
    id: "property-performance",
    title: "Property Performance Report",
    description:
      "Review one property’s income, expenses, occupancy, yield, cash flow and performance over time.",
    descriptionMobile:
      "Review one property’s income, expenses, occupancy, yield and cash flow.",
    usefulFor: "Owner-managers comparing individual property performance.",
    icon: "property",
    categories: ["property-analysis", "portfolio"]
  },
  {
    id: "portfolio",
    title: "Portfolio Report",
    description:
      "Summarise the value, income, expenses, cash flow, equity and occupancy of an entire property portfolio.",
    descriptionMobile:
      "Summarise value, income, equity, cash flow and occupancy across your portfolio.",
    usefulFor: "Investors and landlords managing multiple properties.",
    icon: "portfolio",
    categories: ["portfolio"]
  },
  {
    id: "investor-analytic",
    title: "Investor Analytic Report",
    description:
      "Combine deal metrics, ROI, cash-on-cash return, yield, financing assumptions and long-term projections into a professional investor-facing PDF.",
    descriptionMobile:
      "Present deal metrics, ROI, yield, financing assumptions and long-term projections.",
    usefulFor: "Evaluating acquisitions and presenting investment opportunities.",
    icon: "reports",
    categories: ["property-analysis"]
  },
  {
    id: "cash-flow",
    title: "Cash Flow Report",
    description:
      "Show monthly rental income, vacancies, operating expenses, debt service and net cash flow in a clear report format.",
    descriptionMobile:
      "Show rental income, vacancies, operating expenses, debt service and net cash flow.",
    usefulFor: "Understanding whether a property is profitable month to month.",
    icon: "income",
    categories: ["cash-flow"]
  },
  {
    id: "invoice-generation",
    title: "Invoice Generation",
    description:
      "Create branded tenant invoices from lease and rental data with line items, due dates and payment information.",
    descriptionMobile: "Create branded tenant invoices from lease and rental data.",
    usefulFor: "Landlords who need cleaner monthly rental billing.",
    icon: "invoices",
    categories: ["invoices", "tenant-admin"]
  },
  {
    id: "tenant-statements",
    title: "Tenant Statements",
    description:
      "Create tenant-facing statements showing rent charges, payments, arrears, adjustments and account balances.",
    descriptionMobile:
      "Show rent charges, payments, arrears, adjustments and account balances.",
    usefulFor: "Keeping rental admin transparent and organised.",
    icon: "statements",
    categories: ["statements", "tenant-admin"]
  },
  {
    id: "expense-breakdown",
    title: "Expense Breakdown Report",
    description:
      "Visualise recurring expenses, once-off costs and category-level spending across a property or portfolio.",
    descriptionMobile:
      "Break down recurring expenses, once-off costs and category-level spending.",
    usefulFor: "Finding cost leaks and improving operating margins.",
    icon: "expense",
    categories: ["portfolio", "cash-flow"]
  },
  {
    id: "property-comparison",
    title: "Property Comparison Report",
    description:
      "Compare properties side by side using cash flow, yield, ROI, equity, vacancy and expense ratios.",
    descriptionMobile:
      "Compare properties side by side using yield, ROI, cash flow and expense ratios.",
    usefulFor: "Deciding which properties are winning and which need attention.",
    icon: "activity",
    categories: ["property-analysis", "portfolio"]
  }
];
