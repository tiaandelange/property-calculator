import { describe, expect, it } from "vitest";
import {
  resolveSettingsSection,
  settingsSectionMobileTitle,
  settingsSectionPath,
  getSettingsSection
} from "./settingsSections";

describe("settingsSections", () => {
  it("defaults unknown sections to general", () => {
    expect(resolveSettingsSection(null)).toBe("general");
    expect(resolveSettingsSection("")).toBe("general");
    expect(resolveSettingsSection("not-real")).toBe("general");
  });

  it("resolves known section ids", () => {
    expect(resolveSettingsSection("subscription")).toBe("subscription");
    expect(resolveSettingsSection("invoice-banking")).toBe("invoice-banking");
    expect(resolveSettingsSection("security")).toBe("security");
    expect(resolveSettingsSection("general")).toBe("general");
  });

  it("maps legacy hash targets", () => {
    expect(resolveSettingsSection("applicant-form-template")).toBe("general");
    expect(resolveSettingsSection("workspace")).toBe("general");
  });

  it("builds deep-link paths", () => {
    expect(settingsSectionPath("subscription")).toBe("/settings?section=subscription");
    expect(settingsSectionPath("invoice-banking", { invoiceBanking: "1" })).toBe(
      "/settings?section=invoice-banking&invoiceBanking=1"
    );
  });

  it("uses mobile titles when defined", () => {
    expect(settingsSectionMobileTitle(getSettingsSection("invoice-banking"))).toBe("Invoices");
    expect(settingsSectionMobileTitle(getSettingsSection("security"))).toBe("Security");
  });
});
