import { describe, expect, it } from "vitest";
import {
  messagePlainTextToHtml,
  normalizeRecipientEmails,
  resolveCcEmailForSend,
  validateRecipientEmails
} from "./invoiceEmailValidation.js";

describe("invoiceEmailValidation", () => {
  it("normalizes and validates recipients", () => {
    expect(normalizeRecipientEmails(["A@x.com", "a@x.com"])).toEqual(["a@x.com"]);
    expect(validateRecipientEmails(["tenant@example.com"])).toBeNull();
    expect(validateRecipientEmails([])).toMatch(/required/i);
  });

  it("resolves CC email with invalid saved value falling back to login email", () => {
    expect(
      resolveCcEmailForSend({ ccEmail: "not-an-email" }, "landlord@proplytic.co.za")
    ).toBe("landlord@proplytic.co.za");
    expect(
      resolveCcEmailForSend({ ccEmail: "cc@example.com" }, "landlord@proplytic.co.za")
    ).toBe("cc@example.com");
    expect(resolveCcEmailForSend({ ccEmail: "" }, "landlord@proplytic.co.za")).toBe(
      "landlord@proplytic.co.za"
    );
  });

  it("escapes HTML in message body", () => {
    const html = messagePlainTextToHtml("Hi\n<script>");
    expect(html).toContain("<br />");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
