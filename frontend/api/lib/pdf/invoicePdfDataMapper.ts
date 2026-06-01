import type { InvoicePdfData } from "./invoicePdfLegacyTypes.js";
import { normalizeInvoicePaymentDetails } from "../invoicePaymentDetailsShared.js";
import type { GlobalPdfTheme } from "./globalPdfTheme.js";
import type { InvoicePdfBankingDetails, InvoicePdfDocumentData } from "./invoicePdfTypes.js";

export type InvoicePdfBuildContext = {
  theme: GlobalPdfTheme;
  logoDataUrl?: string | null;
  pdfBrandingEnabled?: boolean;
  landlord: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  /** Property street address for the tenant block (exclude unit). */
  tenantPropertyAddress?: string;
  /** Raw profiles.invoice_payment_details for structured banking + business contact. */
  paymentDetailsRaw?: unknown;
};

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

function bankingFromPaymentDetailLines(
  lines: string[],
  paymentReference: string | null
): InvoicePdfBankingDetails {
  const banking: InvoicePdfBankingDetails = { extraLines: [] };
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("Bank:")) banking.bankName = t.slice(5).trim();
    else if (t.startsWith("Account holder:")) banking.accountHolder = t.slice(15).trim();
    else if (t.startsWith("Account number:")) banking.accountNumber = t.slice(15).trim();
    else if (t.startsWith("Branch / universal code:")) banking.branchCode = t.slice(24).trim();
    else if (t.startsWith("Reference:")) banking.reference = t.slice(10).trim();
    else if (!t.includes("Settings") && !t.includes("banking details")) {
      banking.extraLines!.push(t);
    }
  }
  if (paymentReference && !banking.reference) banking.reference = paymentReference;
  return banking;
}

function bankingFromProfile(raw: unknown, paymentReference: string | null): InvoicePdfBankingDetails {
  const d = normalizeInvoicePaymentDetails(raw);
  const extra = [...d.extraLines];
  const banking: InvoicePdfBankingDetails = {
    accountHolder: d.accountHolder || undefined,
    bankName: d.bankName || undefined,
    accountNumber: d.accountNumber || undefined,
    branchCode: d.branchCode || undefined,
    reference: paymentReference ?? undefined,
    extraLines: extra
  };
  return banking;
}

function parseTenantFromLines(tenantLines: string[]): {
  name: string;
  email?: string;
  phone?: string;
} {
  const lines = tenantLines.filter(Boolean);
  const name = lines[0] ?? "—";
  let email: string | undefined;
  let phone: string | undefined;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("@")) email = line;
    else if (/^ID:/i.test(line)) continue;
    else if (!phone && /[\d+()-]/.test(line)) phone = line;
  }
  return { name, email, phone };
}

/** Map legacy invoice builder input + server context into the global template model. */
export function mapToInvoicePdfDocument(
  data: InvoicePdfData,
  ctx: InvoicePdfBuildContext,
  paymentDetailsRaw?: unknown
): InvoicePdfDocumentData {
  const tenantParsed = parseTenantFromLines(data.tenantLines);
  const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);

  const banking =
    paymentDetailsRaw != null
      ? bankingFromProfile(paymentDetailsRaw, data.paymentReference)
      : bankingFromPaymentDetailLines(data.paymentDetailLines, data.paymentReference);

  const hasStructuredBanking = Boolean(
    banking.bankName || banking.accountHolder || banking.accountNumber || banking.branchCode
  );
  if (!hasStructuredBanking && data.paymentDetailLines.length) {
    Object.assign(banking, bankingFromPaymentDetailLines(data.paymentDetailLines, data.paymentReference));
  }

  return {
    documentKind: "invoice",
    invoiceId: data.invoiceId,
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    status: data.status,
    subtotal: data.subtotal,
    taxTotal: data.taxTotal,
    total: data.total,
    amountPaid: paymentsTotal > 0 ? paymentsTotal : undefined,
    balanceDue: data.balanceDue,
    currency: "ZAR",
    notes: data.notes,
    paymentReference: data.paymentReference,
    lineItems: data.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitAmount: li.unitPrice,
      amount: li.total
    })),
    payments: data.payments,
    tenant: {
      name: tenantParsed.name,
      email: tenantParsed.email,
      phone: tenantParsed.phone,
      address: ctx.tenantPropertyAddress
    },
    landlord: ctx.landlord,
    banking,
    branding: {
      logoDataUrl: ctx.logoDataUrl,
      pdfBrandingEnabled: ctx.pdfBrandingEnabled !== false,
      theme: ctx.theme
    },
    isDraftPreview: data.isDraftPreview
  };
}
