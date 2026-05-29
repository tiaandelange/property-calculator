import type { InvoiceStatus } from "./invoiceFoundation";

export type InvoiceDirectoryRow = {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitLabel: string | null;
  leaseId: string | null;
  leaseLabel: string | null;
  invoicePeriod: string | null;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  balanceDue: number;
  status: InvoiceStatus;
  isEditable: boolean;
  hasPdf: boolean;
  invoiceType: string;
};

export type InvoiceDirectoryMetrics = {
  totalOutstanding: number;
  dueThisMonth: number;
  overdue: number;
  paidThisMonth: number;
};

export type InvoiceDirectoryFilters = {
  q: string;
  propertyId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  overdueOnly: boolean;
};

export type InvoicesDirectoryResult = {
  items: InvoiceDirectoryRow[];
  metrics: InvoiceDirectoryMetrics;
  properties: Array<{ id: string; name: string }>;
};
