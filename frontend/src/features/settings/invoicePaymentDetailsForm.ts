import type { InvoicePaymentDetailsPayload } from "../../services/profileSupabase";

export type InvoicePaymentDetailsFormState = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  referenceNote: string;
  extraLinesText: string;
  ccEmail: string;
};

export function emptyInvoicePaymentDetailsForm(): InvoicePaymentDetailsFormState {
  return {
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    branchCode: "",
    referenceNote: "",
    extraLinesText: "",
    ccEmail: ""
  };
}

export function invoicePaymentDetailsFormFromApi(raw: unknown): InvoicePaymentDetailsFormState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyInvoicePaymentDetailsForm();
  }
  const d = raw as Record<string, unknown>;
  const extraLines = Array.isArray(d.extraLines)
    ? d.extraLines.filter((x): x is string => typeof x === "string")
    : [];
  return {
    bankName: typeof d.bankName === "string" ? d.bankName : "",
    accountHolder: typeof d.accountHolder === "string" ? d.accountHolder : "",
    accountNumber: typeof d.accountNumber === "string" ? d.accountNumber : "",
    branchCode: typeof d.branchCode === "string" ? d.branchCode : "",
    referenceNote: typeof d.referenceNote === "string" ? d.referenceNote : "",
    extraLinesText: extraLines.join("\n"),
    ccEmail: typeof d.ccEmail === "string" ? d.ccEmail : ""
  };
}

export function invoicePaymentDetailsFormToPayload(
  form: InvoicePaymentDetailsFormState
): InvoicePaymentDetailsPayload {
  const extraLines = form.extraLinesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    bankName: form.bankName.trim(),
    accountHolder: form.accountHolder.trim(),
    accountNumber: form.accountNumber.trim(),
    branchCode: form.branchCode.trim(),
    referenceNote: form.referenceNote.trim(),
    extraLines,
    ccEmail: form.ccEmail.trim()
  };
}
