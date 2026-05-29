import { describe, expect, it } from "vitest";
import { propertyUnitDisplayLabel } from "./propertyUnitDisplayLabel";

describe("propertyUnitDisplayLabel", () => {
  it("reads unit_name from PostgREST embed", () => {
    expect(propertyUnitDisplayLabel({ unit_name: "Unit A" })).toBe("Unit A");
    expect(propertyUnitDisplayLabel({ unitName: "Main House" })).toBe("Main House");
    expect(propertyUnitDisplayLabel(null)).toBeNull();
  });
});
