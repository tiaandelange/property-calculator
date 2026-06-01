import { fmtZar } from "./invoiceDirectoryUtils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isValidEmailAddress(email: string): boolean {
  const s = email.trim();
  if (!s || s.length > 320) return false;
  return EMAIL_RE.test(s);
}

export function normalizeRecipientEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of emails) {
    const e = item.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export type InvoiceEmailTemplateContext = {
  propertyName: string;
  invoiceNumber: string;
  tenantFirstName: string;
  formattedTotalAmount: string;
  formattedDueDate: string;
  userOrBusinessName: string;
};

function applyTemplate(template: string, ctx: InvoiceEmailTemplateContext): string {
  return template
    .replace(/\{propertyName\}/g, ctx.propertyName)
    .replace(/\{invoiceNumber\}/g, ctx.invoiceNumber)
    .replace(/\{tenantFirstName\}/g, ctx.tenantFirstName)
    .replace(/\{formattedTotalAmount\}/g, ctx.formattedTotalAmount)
    .replace(/\{formattedDueDate\}/g, ctx.formattedDueDate)
    .replace(/\{userOrBusinessName\}/g, ctx.userOrBusinessName);
}

export function buildInvoiceEmailTemplateContext(input: {
  propertyName?: string | null;
  invoiceNumber: string;
  tenantFirstName?: string | null;
  totalAmount: number;
  balanceDue?: number | null;
  dueDate?: string | null;
  userOrBusinessName?: string | null;
}): InvoiceEmailTemplateContext {
  const amount = input.balanceDue != null && input.balanceDue > 0 ? input.balanceDue : input.totalAmount;
  const due = input.dueDate ? String(input.dueDate).slice(0, 10) : "";
  let formattedDueDate = due;
  if (due) {
    const d = new Date(due);
    formattedDueDate = Number.isNaN(d.getTime())
      ? due
      : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  }

  return {
    propertyName: (input.propertyName ?? "your property").trim() || "your property",
    invoiceNumber: input.invoiceNumber.trim() || "invoice",
    tenantFirstName: (input.tenantFirstName ?? "there").trim() || "there",
    formattedTotalAmount: fmtZar(amount),
    formattedDueDate: formattedDueDate || "—",
    userOrBusinessName: (input.userOrBusinessName ?? "Proplytic").trim() || "Proplytic"
  };
}

export function defaultInvoiceEmailSubject(
  ctx: InvoiceEmailTemplateContext,
  settingsSubject?: string | null
): string {
  const fromSettings = settingsSubject?.trim();
  if (fromSettings) return applyTemplate(fromSettings, ctx);
  return `Invoice for ${ctx.propertyName} - ${ctx.invoiceNumber}`;
}

export function defaultInvoiceEmailMessage(
  ctx: InvoiceEmailTemplateContext,
  settingsBody?: string | null
): string {
  const fromSettings = settingsBody?.trim();
  if (fromSettings) return applyTemplate(fromSettings, ctx);
  return `Hi ${ctx.tenantFirstName},

Please find attached your invoice for ${ctx.propertyName}.

Amount due: ${ctx.formattedTotalAmount}
Due date: ${ctx.formattedDueDate}

Kind regards,
${ctx.userOrBusinessName}`;
}

/** Optional overrides stored in profiles.invoice_payment_details JSON. */
export function emailTemplateFromPaymentDetails(details: unknown): {
  subject?: string;
  body?: string;
} {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const d = details as Record<string, unknown>;
  return {
    subject:
      typeof d.defaultInvoiceEmailSubject === "string"
        ? d.defaultInvoiceEmailSubject
        : typeof d.default_invoice_email_subject === "string"
          ? d.default_invoice_email_subject
          : undefined,
    body:
      typeof d.defaultInvoiceEmailBody === "string"
        ? d.defaultInvoiceEmailBody
        : typeof d.default_invoice_email_body === "string"
          ? d.default_invoice_email_body
          : undefined
  };
}
