import { describe, expect, it } from "vitest";
import { mapPropertyBondPayment } from "./propertyBondAdapter";

describe("mapPropertyBondPayment", () => {
  it("returns empty when no outstanding balance", () => {
    expect(mapPropertyBondPayment({ name: "Flat 1", outstandingBondBalance: 0 }, "Flat 1")).toEqual([]);
    expect(mapPropertyBondPayment(null, "Flat 1")).toEqual([]);
  });

  it("builds bond row from property profile using amortisation", () => {
    const rows = mapPropertyBondPayment(
      {
        name: "Oak Street",
        outstandingBondBalance: 1_350_000,
        bondAnnualInterestRatePercent: 11.25,
        bondTermYears: 20,
        bondStartDate: "2020-01-01"
      },
      "Oak Street",
      new Date("2026-05-29")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Oak Street bond");
    expect(rows[0]?.interestRateLabel).toBe("11.25% p.a.");
    expect(rows[0]?.monthlyPayment).toBeGreaterThan(0);
    expect(rows[0]?.termLabel).toMatch(/20 years/);
    expect(rows[0]?.termLabel).toMatch(/months left/);
    expect(rows[0]?.outstandingBalance).toBe(1_350_000);
  });

  it("marks incomplete when rate or term missing", () => {
    const rows = mapPropertyBondPayment(
      { outstandingBondBalance: 500_000 },
      "Test"
    );
    expect(rows[0]?.status).toBe("incomplete");
  });
});
