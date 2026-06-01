import { describe, expect, it } from "vitest";
import {
  messagePlainTextToHtml,
  normalizeRecipientEmails,
  validateRecipientEmails
} from "./invoiceEmailValidation.js";

describe("invoiceEmailValidation", () => {
  it("normalizes and validates recipients", () => {
    expect(normalizeRecipientEmails(["A@x.com", "a@x.com"])).toEqual(["a@x.com"]);
    expect(validateRecipientEmails(["tenant@example.com"])).toBeNull();
    expect(validateRecipientEmails([])).toMatch(/required/i);
  });

  it("escapes HTML in message body", () => {
    const html = messagePlainTextToHtml("Hi\n<script>");
    expect(html).toContain("<br />");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
