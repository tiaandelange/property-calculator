import { describe, expect, it } from "vitest";
import {
  buildInvoiceEmailTemplateContext,
  defaultInvoiceEmailMessage,
  defaultInvoiceEmailSubject,
  isValidEmailAddress,
  normalizeRecipientEmails
} from "./invoiceEmailDefaults";

describe("invoiceEmailDefaults", () => {
  it("validates email addresses", () => {
    expect(isValidEmailAddress("a@b.co")).toBe(true);
    expect(isValidEmailAddress("bad")).toBe(false);
  });

  it("deduplicates recipient emails", () => {
    expect(normalizeRecipientEmails(["A@x.com", "a@x.com", " b@x.com "])).toEqual(["a@x.com", "b@x.com"]);
  });

  it("builds fallback subject and message", () => {
    const ctx = buildInvoiceEmailTemplateContext({
      propertyName: "Unit 4",
      invoiceNumber: "INV-1",
      tenantFirstName: "Sam",
      totalAmount: 1000,
      dueDate: "2026-06-15",
      userOrBusinessName: "Proplytic"
    });
    expect(defaultInvoiceEmailSubject(ctx)).toContain("Unit 4");
    expect(defaultInvoiceEmailMessage(ctx)).toContain("Sam");
    expect(defaultInvoiceEmailMessage(ctx)).toContain("Amount due:");
  });
});
