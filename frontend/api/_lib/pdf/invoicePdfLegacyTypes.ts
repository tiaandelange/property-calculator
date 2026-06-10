export type InvoicePdfLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoicePdfPayment = {
  date: string;
  reference: string | null;
  amount: number;
};

/** @deprecated Ledger section removed from invoice PDFs */
export type InvoicePdfLedgerRow = {
  date: string;
  desc: string;
  charge: string;
  payment: string;
};

/** Input shape used by the invoice PDF server pipeline (legacy-compatible). */
export type InvoicePdfData = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxTotal?: number;
  total: number;
  balanceDue: number;
  notes: string | null;
  tenantLines: string[];
  propertyLines: string[];
  unitLabel: string | null;
  leaseLabel: string | null;
  paymentReference: string | null;
  lineItems: InvoicePdfLineItem[];
  payments: InvoicePdfPayment[];
  /** @deprecated Unused — ledger removed from PDF */
  ledgerRows?: InvoicePdfLedgerRow[];
  /** @deprecated Unused */
  totalDueOutstanding?: number;
  paymentDetailLines: string[];
  isDraftPreview?: boolean;
};
