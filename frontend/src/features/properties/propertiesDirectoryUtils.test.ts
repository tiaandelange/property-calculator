import { describe, expect, it } from "vitest";
import {
  investmentTypeSqlFilter,
  matchesPropertyOccupancyFilter,
  needsFinancialSort,
  needsOccupancyAggregateFilter,
  sortPropertyDirectoryItems
} from "./propertiesDirectoryUtils";
import type { PropertyListItem } from "../../services/propertiesSupabase";

const baseProperty = (patch: Partial<PropertyListItem>): PropertyListItem =>
  ({
    id: "p1",
    name: "Test",
    createdAt: "2026-01-01T00:00:00Z",
    monthlyNOI: 0,
    monthlyCashFlowAfterDebtService: 0,
    netCashFlow: 0,
    currentEstimatedValue: null,
    outstandingBondBalance: null,
    rentOverdue: false,
    ...patch
  }) as PropertyListItem;

describe("propertiesDirectoryUtils", () => {
  it("detects financial and occupancy filter modes", () => {
    expect(needsFinancialSort("RECENT")).toBe(false);
    expect(needsFinancialSort("HIGHEST_NOI")).toBe(true);
    expect(needsOccupancyAggregateFilter("VACANT")).toBe(true);
    expect(needsOccupancyAggregateFilter("LAND")).toBe(false);
    expect(investmentTypeSqlFilter("LAND")).toEqual(["VACANT_LAND"]);
  });

  it("matches occupancy status filters", () => {
    expect(matchesPropertyOccupancyFilter({ occupancyStatus: "OCCUPIED", investmentType: "LONG_TERM_RENTAL" }, "OCCUPIED")).toBe(true);
    expect(matchesPropertyOccupancyFilter({ occupancyStatus: "VACANT", investmentType: "LONG_TERM_RENTAL" }, "VACANT")).toBe(true);
    expect(matchesPropertyOccupancyFilter({ occupancyStatus: "VACANT", investmentType: "VACANT_LAND" }, "VACANT")).toBe(false);
  });

  it("sorts by NOI descending", () => {
    const sorted = sortPropertyDirectoryItems(
      [
        baseProperty({ id: "a", monthlyIncome: 100, monthlyOperatingExpenses: 0 }),
        baseProperty({ id: "b", monthlyIncome: 500, monthlyOperatingExpenses: 0 })
      ],
      "HIGHEST_NOI"
    );
    expect(sorted.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
