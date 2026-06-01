import type { GlobalPdfTheme } from "./globalPdfTheme.js";

export type InvoicePdfLineItemRow = {
  description: string;
  quantity?: number | string;
  unitAmount?: number;
  amount: number;
};

export type InvoicePdfPaymentRow = {
  date: string;
  reference: string | null;
  amount: number;
};

export type InvoicePdfBankingDetails = {
  accountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
  reference?: string;
  extraLines?: string[];
};

export type InvoicePdfDocumentData = {
  documentKind: "invoice";
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxTotal?: number;
  total: number;
  amountPaid?: number;
  balanceDue: number;
  currency: string;
  notes: string | null;
  paymentReference: string | null;
  lineItems: InvoicePdfLineItemRow[];
  payments: InvoicePdfPaymentRow[];
  tenant: {
    name: string;
    email?: string;
    phone?: string;
    /** Property street address (not unit). */
    address?: string;
  };
  landlord: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  banking: InvoicePdfBankingDetails;
  branding: {
    logoDataUrl?: string | null;
    pdfBrandingEnabled: boolean;
    theme: GlobalPdfTheme;
  };
  /** When true, header issuer lines are business details from settings. */
  useBusinessForFinancials?: boolean;
  isDraftPreview?: boolean;
};
