import { describe, expect, it } from "vitest";
import { validateContactFormValues } from "./contactFormClientValidation";

describe("validateContactFormValues", () => {
  it("requires name and message", () => {
    expect(
      validateContactFormValues({
        name: "",
        email: "a@b.co",
        phone: "",
        subject: "Hi",
        message: "Hello",
        website: ""
      })
    ).toBe("Name is required.");
  });

  it("accepts valid values", () => {
    expect(
      validateContactFormValues({
        name: "Jane",
        email: "jane@example.com",
        phone: "",
        subject: "Plans",
        message: "Question about Investor.",
        website: ""
      })
    ).toBeNull();
  });
});
