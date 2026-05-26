export type TenantStatementPeriodKey = "this_month" | "last_6_months" | "last_12_months" | "since_lease";

export type TenantLedgerTxnType =
  | "balance"
  | "charge"
  | "payment"
  | "adjustment"
  | "late_fee"
  | "credit"
  | string;

export type TenantStatementSummary = {
  tenantId: string;
  tenantName: string;
  tenantAvatarUrl?: string | null;
  propertyId: string;
  propertyName: string;
  unitName?: string | null;
  status?: string | null;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  periodLabel: string;
  openingBalance: number;
  charges: number;
  payments: number;
  adjustments: number;
  closingBalance: number;
  outstandingBalance: number;
  availableCredit: number;
  monthCharges: number;
  monthPayments: number;
};

export type TenantLedgerTransaction = {
  id: string;
  date: string;
  description: string;
  type: TenantLedgerTxnType;
  amount: number;
  balance: number;
  source?: string;
  status?: string;
  raw?: Record<string, unknown>;
};

export type TenantInvoiceListItem = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  dueDate: string;
  invoiceDate: string;
  paidAt?: string | null;
  hasPdf?: boolean;
};
