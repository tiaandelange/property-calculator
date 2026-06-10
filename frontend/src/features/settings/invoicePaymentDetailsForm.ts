import type { InvoicePaymentDetailsPayload } from "../../services/profileSupabase";
import { normalizeInvoicePaymentDetails } from "../../../api/_lib/invoicePaymentDetailsShared";

export type InvoicePaymentDetailsFormState = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  extraLinesText: string;
  ccEmail: string;
};

export function emptyInvoicePaymentDetailsForm(): InvoicePaymentDetailsFormState {
  return {
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    branchCode: "",
    extraLinesText: "",
    ccEmail: ""
  };
}

export function invoicePaymentDetailsFormFromApi(raw: unknown): InvoicePaymentDetailsFormState {
  const d = normalizeInvoicePaymentDetails(raw);
  return {
    bankName: d.bankName,
    accountHolder: d.accountHolder,
    accountNumber: d.accountNumber,
    branchCode: d.branchCode,
    extraLinesText: d.extraLines.join("\n"),
    ccEmail: d.ccEmail
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
    extraLines,
    ccEmail: form.ccEmail.trim()
  };
}
