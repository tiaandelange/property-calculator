import { describe, expect, it } from "vitest";
import { resolveSettingsSection, settingsSectionPath } from "./settingsSections";

describe("settingsSections", () => {
  it("defaults unknown sections to account", () => {
    expect(resolveSettingsSection(null)).toBe("account");
    expect(resolveSettingsSection("")).toBe("account");
    expect(resolveSettingsSection("not-real")).toBe("account");
  });

  it("resolves known section ids", () => {
    expect(resolveSettingsSection("subscription")).toBe("subscription");
    expect(resolveSettingsSection("invoice-banking")).toBe("invoice-banking");
    expect(resolveSettingsSection("security")).toBe("security");
  });

  it("maps legacy hash targets", () => {
    expect(resolveSettingsSection("applicant-form-template")).toBe("workspace");
  });

  it("builds deep-link paths", () => {
    expect(settingsSectionPath("subscription")).toBe("/settings?section=subscription");
    expect(settingsSectionPath("invoice-banking", { invoiceBanking: "1" })).toBe(
      "/settings?section=invoice-banking&invoiceBanking=1"
    );
  });
});
