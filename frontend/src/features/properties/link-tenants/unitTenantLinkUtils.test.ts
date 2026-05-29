import { describe, expect, it } from "vitest";
import { sumExpectedRentForUnits } from "./unitTenantLinkUtils";
import type { PropertyUnitDraft } from "../units/propertyUnitTypes";

describe("sumExpectedRentForUnits", () => {
  it("counts rent once per unit regardless of tenant count", () => {
    const units: PropertyUnitDraft[] = [
      {
        clientId: "u1",
        unitName: "Unit 1",
        expectedRent: 8000,
        rentFrequency: "monthly",
        occupancyStatus: "vacant",
        sortOrder: 0,
        isActive: true
      },
      {
        clientId: "u2",
        unitName: "Unit 2",
        expectedRent: 7000,
        rentFrequency: "monthly",
        occupancyStatus: "vacant",
        sortOrder: 1,
        isActive: true
      }
    ];
    expect(sumExpectedRentForUnits(units)).toBe(15000);
  });
});
