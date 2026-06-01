/**
 * Invoice payment / banking details — shared by PDF generation and the settings UI.
 */

export type NormalizedInvoicePaymentDetails = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  extraLines: string[];
  ccEmail: string;
};

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

export function normalizeInvoicePaymentDetails(raw: unknown): NormalizedInvoicePaymentDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      branchCode: "",
      extraLines: [],
      ccEmail: ""
    };
  }
  const d = raw as Record<string, unknown>;
  const extraRaw = d.extraLines ?? d.extra_lines;
  const extraLines = Array.isArray(extraRaw)
    ? extraRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  return {
    bankName: str(d.bankName ?? d.bank_name),
    accountHolder: str(d.accountHolder ?? d.account_holder),
    accountNumber: str(d.accountNumber ?? d.account_number),
    branchCode: str(d.branchCode ?? d.branch_code),
    extraLines,
    ccEmail: str(d.ccEmail ?? d.cc_email)
  };
}

/** Payment reference on the invoice is always the linked lease reference when available. */
export function invoicePaymentReferenceForInvoice(
  leaseReference: string | null | undefined,
  invoiceNumber: string
): string | null {
  const leaseRef = leaseReference?.trim();
  if (leaseRef) return leaseRef;
  const num = invoiceNumber.trim();
  return num || null;
}

/** Banking lines for PDF footer — profile banking only; reference comes from the lease. */
export function paymentDetailsLinesForInvoice(
  raw: unknown,
  leaseReference?: string | null
): string[] {
  const d = normalizeInvoicePaymentDetails(raw);
  const lines: string[] = [];
  if (d.bankName) lines.push(`Bank: ${d.bankName}`);
  if (d.accountHolder) lines.push(`Account holder: ${d.accountHolder}`);
  if (d.accountNumber) lines.push(`Account number: ${d.accountNumber}`);
  if (d.branchCode) lines.push(`Branch / universal code: ${d.branchCode}`);
  const leaseRef = leaseReference?.trim();
  if (leaseRef) lines.push(`Reference: ${leaseRef}`);
  for (const x of d.extraLines) {
    if (x.trim()) lines.push(x.trim());
  }
  const hasBanking = Boolean(d.bankName || d.accountHolder || d.accountNumber || d.branchCode);
  if (!lines.length) {
    return hasBanking
      ? lines
      : ["Add your banking details under Settings → Invoice & banking details."];
  }
  return lines;
}

export function leaseReferenceFromEmbed(lease: Record<string, unknown> | null): string | null {
  if (!lease) return null;
  const ref = lease.lease_reference ?? lease.leaseReference;
  const s = ref != null ? String(ref).trim() : "";
  return s || null;
}
