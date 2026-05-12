import { describe, expect, it } from "vitest";
import { isWorkspacePath } from "./workspacePaths";

describe("isWorkspacePath", () => {
  it("treats portfolio and property routes as workspace", () => {
    expect(isWorkspacePath("/owned-properties/dashboard")).toBe(true);
    expect(isWorkspacePath("/tenants")).toBe(true);
    expect(isWorkspacePath("/leases")).toBe(true);
  });

  it("excludes public marketing and calculator routes (shared marketing shell)", () => {
    expect(isWorkspacePath("/")).toBe(false);
    expect(isWorkspacePath("/learn")).toBe(false);
    expect(isWorkspacePath("/about")).toBe(false);
    expect(isWorkspacePath("/calculators")).toBe(false);
    expect(isWorkspacePath("/calculators/transfer-bond-costs")).toBe(false);
    expect(isWorkspacePath("/help")).toBe(false);
    expect(isWorkspacePath("/contact")).toBe(false);
    expect(isWorkspacePath("/faq")).toBe(false);
    expect(isWorkspacePath("/feedback")).toBe(false);
  });

  it("includes dashboard, account, subscription, admin, and settings", () => {
    expect(isWorkspacePath("/dashboard")).toBe(true);
    expect(isWorkspacePath("/account")).toBe(true);
    expect(isWorkspacePath("/subscription")).toBe(true);
    expect(isWorkspacePath("/subscription/success")).toBe(true);
    expect(isWorkspacePath("/admin")).toBe(true);
    expect(isWorkspacePath("/settings")).toBe(true);
    expect(isWorkspacePath("/settings/security")).toBe(true);
  });
});
