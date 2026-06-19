import { describe, expect, it } from "vitest";
import {
  dedupeAddressParts,
  formatTableLeaseTerm,
  formatTablePropertyAddress
} from "./tableCellFormatters";

describe("tableCellFormatters", () => {
  it("dedupes repeated address parts", () => {
    expect(dedupeAddressParts("926, 33rd Avenue, Villieria, Villieria, Pretoria")).toEqual([
      "926",
      "33rd Avenue",
      "Villieria",
      "Pretoria"
    ]);
  });

  it("shortens property addresses for table cells", () => {
    const formatted = formatTablePropertyAddress("33rd Avenue 926", "926, 33rd Avenue, Villieria, Pretoria");
    expect(formatted.primary).toBe("33rd Avenue 926");
    expect(formatted.secondary).toBe("Villieria, Pretoria");
    expect(formatted.fullTitle).toContain("33rd Avenue 926");
  });

  it("formats lease terms with arrow separator", () => {
    const term = formatTableLeaseTerm("2026-07-01", "2027-06-30");
    expect(term?.startLabel).toBeTruthy();
    expect(term?.endLabel).toBeTruthy();
    expect(term?.fullTitle).toContain("–");
  });
});
