import { describe, expect, it } from "vitest";
import { propertyLeasesPath } from "./leaseRoutes";

describe("propertyLeasesPath", () => {
  it("builds property leases tab URL", () => {
    expect(propertyLeasesPath("abc-123")).toBe("/owned-properties/abc-123?tab=leases");
  });

  it("includes leaseId when highlighting a lease card", () => {
    expect(propertyLeasesPath("abc-123", "lease-9")).toBe("/owned-properties/abc-123?tab=leases&leaseId=lease-9");
  });
});
