import { describe, expect, it } from "vitest";
import { isInternalAppPath } from "./routerLinks";

describe("isInternalAppPath", () => {
  it("accepts app routes and query strings", () => {
    expect(isInternalAppPath("/tenants")).toBe(true);
    expect(isInternalAppPath("/tenants?tab=applicants")).toBe(true);
  });

  it("rejects external and special schemes", () => {
    expect(isInternalAppPath("https://example.com")).toBe(false);
    expect(isInternalAppPath("mailto:a@b.com")).toBe(false);
    expect(isInternalAppPath("//cdn.example.com/x")).toBe(false);
    expect(isInternalAppPath(undefined)).toBe(false);
  });
});
