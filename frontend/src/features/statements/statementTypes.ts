export type TenantStatementDocumentType = "FINANCIAL" | "DEPOSIT";

export type StatementEntryType = "DEBIT" | "CREDIT";

export type StatementPeriodKey =
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "year_to_date"
  | "since_lease";

export const STATEMENT_PERIOD_OPTIONS: { value: StatementPeriodKey; label: string }[] = [
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "year_to_date", label: "Year to date" },
  { value: "since_lease", label: "Since lease start" }
];

export type StatementLineItemDraft = {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  entryType: StatementEntryType;
  sortOrder: number;
  taxRate: number;
  transactionDate?: string | null;
};
