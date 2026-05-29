import { describe, expect, it } from "vitest";
import {
  mapPropertyBondPayment,
  mapAdditionalBondPayments,
  mergeBondFieldsFromStatement,
  normalizePropertyBondFields,
  propertyHasBondProfile
} from "./propertyBondAdapter";

describe("normalizePropertyBondFields", () => {
  it("reads snake_case bond columns", () => {
    const fields = normalizePropertyBondFields({
      outstanding_bond_balance: 900_000,
      bond_annual_interest_rate_percent: 10.5,
      bond_term_years: 20,
      bond_start_date: "2019-06-01"
    });
    expect(fields.outstandingBondBalance).toBe(900_000);
    expect(fields.bondAnnualInterestRatePercent).toBe(10.5);
    expect(fields.bondTermYears).toBe(20);
    expect(fields.bondStartDate).toBe("2019-06-01");
  });
});

describe("propertyHasBondProfile", () => {
  it("detects profile from rate and term without balance", () => {
    expect(
      propertyHasBondProfile({
        outstandingBondBalance: null,
        monthlyBondPayment: null,
        bondAnnualInterestRatePercent: 11,
        bondTermYears: 20,
        bondStartDate: "2020-01-01",
        bondRemainingTermMonths: null,
        bondInterestPortionOverride: null,
        bondPrincipalPortionOverride: null
      })
    ).toBe(true);
  });
});

describe("mapPropertyBondPayment", () => {
  it("returns empty when no bond profile signals", () => {
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
    expect(rows[0]?.termLabel).toBe("20 years");
    expect(rows[0]?.termHoverLabel).toMatch(/months left/);
    expect(rows[0]?.outstandingBalance).toBe(1_350_000);
  });

  it("shows row when monthly payment is set but balance is missing", () => {
    const rows = mapPropertyBondPayment(
      {
        monthlyBondPayment: 12_500,
        bondAnnualInterestRatePercent: 10,
        bondTermYears: 20,
        bondStartDate: "2022-03-01"
      },
      "Riverside"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.monthlyPayment).toBe(12_500);
    expect(rows[0]?.status).toBe("active");
  });

  it("marks incomplete when rate or term missing", () => {
    const rows = mapPropertyBondPayment({ outstandingBondBalance: 500_000 }, "Test");
    expect(rows[0]?.status).toBe("incomplete");
  });

  it("merges outstanding balance from statement bondFinance", () => {
    const rows = mapPropertyBondPayment(null, "Merged", {
      statementBondFinance: {
        outstandingBalance: 750_000,
        annualInterestRatePercent: 9.5,
        bondTermYears: 15,
        bondStartDate: "2021-01-01",
        paymentThisMonth: 8_200
      }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outstandingBalance).toBe(750_000);
  });

  it("maps additional bond rows separately from property profile", () => {
    const rows = mapAdditionalBondPayments([
      {
        id: "bond-1",
        description: "Access bond",
        outstandingBalance: 120_000,
        monthlyPayment: 2_400,
        bondAnnualInterestRatePercent: 12,
        bondTermYears: 10,
        bondStartDate: "2023-04-01",
        bondRemainingTermMonths: null
      }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("additional");
    expect(rows[0]?.name).toBe("Access bond");
    expect(rows[0]?.monthlyPayment).toBe(2_400);
    expect(rows[0]?.termLabel).toBe("10 years");
  });
});
