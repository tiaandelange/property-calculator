import { describe, it, expect } from "vitest";
import { resolveTenantPropertyId, resolveTenantPropertyName } from "./tenantPropertyContext";

describe("tenantPropertyContext", () => {
  it("uses current lease property when tenant.property_id is unset", () => {
    const tenant = { propertyId: null, property: null };
    const currentLease = {
      propertyId: "prop-1",
      property: { id: "prop-1", name: "Oak House" }
    };
    expect(resolveTenantPropertyId(tenant, currentLease)).toBe("prop-1");
    expect(resolveTenantPropertyName(tenant, currentLease)).toBe("Oak House");
  });
});
