import { describe, expect, it } from "vitest";
import { derivePropertyOccupancy, effectiveActiveUnitCount } from "./propertyOccupancy";

describe("derivePropertyOccupancy", () => {
  it("single-family: one lease is occupied, never partial", () => {
    const r = derivePropertyOccupancy({
      structureTypeId: "single_family_house",
      activeLeaseCount: 1,
      totalUnitCount: 1
    });
    expect(r.code).toBe("OCCUPIED");
    expect(r.label).toBe("Occupied");
  });

  it("duplex: one of two leases is partially rented", () => {
    const r = derivePropertyOccupancy({
      structureTypeId: "duplex",
      activeLeaseCount: 1,
      totalUnitCount: 2
    });
    expect(r.code).toBe("PARTIALLY_OCCUPIED");
    expect(r.label).toBe("Partially rented");
  });

  it("multi-family: all units leased is occupied", () => {
    const r = derivePropertyOccupancy({
      structureTypeId: "multi_family",
      activeLeaseCount: 4,
      totalUnitCount: 4
    });
    expect(r.code).toBe("OCCUPIED");
  });

  it("no leases is vacant", () => {
    const r = derivePropertyOccupancy({
      structureTypeId: "duplex",
      activeLeaseCount: 0,
      totalUnitCount: 2
    });
    expect(r.code).toBe("VACANT");
  });
});

describe("effectiveActiveUnitCount", () => {
  it("duplex defaults to 2 without saved rows", () => {
    expect(effectiveActiveUnitCount("duplex", null)).toBe(2);
  });
});
