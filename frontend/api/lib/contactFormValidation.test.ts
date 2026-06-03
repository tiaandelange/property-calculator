import { describe, expect, it } from "vitest";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  isContactHoneypotTriggered,
  parseContactFormBody,
  validateContactFormPayload
} from "./contactFormValidation";

describe("contactFormValidation", () => {
  it("requires core fields", () => {
    const payload = parseContactFormBody({});
    expect(validateContactFormPayload(payload)).toBe("Name is required.");
  });

  it("rejects invalid email", () => {
    const payload = parseContactFormBody({
      name: "Jane",
      email: "not-an-email",
      subject: "Hello",
      message: "Test"
    });
    expect(validateContactFormPayload(payload)).toBe("Email address is invalid.");
  });

  it("enforces message max length", () => {
    const payload = parseContactFormBody({
      name: "Jane",
      email: "jane@example.com",
      subject: "Hello",
      message: "x".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1)
    });
    expect(validateContactFormPayload(payload)).toContain("3000");
  });

  it("detects honeypot website field", () => {
    const payload = parseContactFormBody({ website: "https://spam.test" });
    expect(isContactHoneypotTriggered(payload.website)).toBe(true);
  });

  it("accepts valid payload", () => {
    const payload = parseContactFormBody({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+27 82 000 0000",
      subject: "Pricing question",
      message: "I'd like to know more about Investor."
    });
    expect(validateContactFormPayload(payload)).toBeNull();
  });
});
