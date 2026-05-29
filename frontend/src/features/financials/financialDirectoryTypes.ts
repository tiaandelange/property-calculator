export type FinancialStatementRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  date: string;
  description: string;
  type: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  source: string;
  sourceId: string | null;
  status: string;
  invoiceNumber?: string | null;
  invoiceId?: string | null;
  statementType?: string | null;
  tenantId?: string | null;
  expenseCategory?: string | null;
};

export type FinancialDirectoryMetrics = {
  receivedThisMonth: number;
  expectedThisMonth: number;
  expensesThisMonth: number;
  bondThisMonth: number;
  netCashFlow: number;
  propertyCount: number;
};

export type FinancialFilters = {
  q: string;
  propertyId: string;
  month: string;
  source: string;
};

export type FinancialsDirectoryResult = {
  items: FinancialStatementRow[];
  metrics: FinancialDirectoryMetrics;
  properties: Array<{ id: string; name: string }>;
  warnings: string[];
};
