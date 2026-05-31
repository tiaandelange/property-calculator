import { describe, expect, it } from "vitest";
import { routePrefetchTarget } from "./routePrefetch";

describe("routePrefetchTarget", () => {
  it("maps sidebar list routes before property-detail regex", () => {
    expect(routePrefetchTarget("/owned-properties/my-properties")).toBe("properties");
    expect(routePrefetchTarget("/owned-properties/dashboard")).toBe("dashboard");
    expect(routePrefetchTarget("/owned-properties/recurring-invoices")).toBe(null);
    expect(routePrefetchTarget("/owned-properties/new")).toBe(null);
  });

  it("maps standard workspace nav paths", () => {
    expect(routePrefetchTarget("/tenants")).toBe("tenants");
    expect(routePrefetchTarget("/leases")).toBe("leases");
    expect(routePrefetchTarget("/invoices")).toBe("invoices");
    expect(routePrefetchTarget("/financials")).toBe("financials");
    expect(routePrefetchTarget("/settings")).toBe("settings");
    expect(routePrefetchTarget("/dashboard")).toBe("dashboard");
  });

  it("maps property detail and invoice detail", () => {
    expect(routePrefetchTarget("/owned-properties/abc-123")).toBe("property-detail");
    expect(routePrefetchTarget("/invoices/inv-42")).toBe("invoice-detail");
    expect(routePrefetchTarget("/invoices/new")).toBe("invoice-detail");
    expect(routePrefetchTarget("/invoices/legacy")).toBe("invoices");
  });
});
