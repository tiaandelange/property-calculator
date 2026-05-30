import { describe, expect, it } from "vitest";
import {
  computeMaintenancePercentFromStatement,
  computeVacancyPercentFromHistory,
  formatMetricPercent
} from "./propertyFinancialMetrics";

describe("propertyFinancialMetrics", () => {
  it("computes maintenance percent from actual maintenance expenses over income", () => {
    const pct = computeMaintenancePercentFromStatement([
      { date: "2026-01-15", source: "INCOME", status: "RECEIVED", credit: 10_000 },
      { date: "2026-02-10", source: "EXPENSE", status: "ACTIVE", debit: 500, expenseCategory: "MAINTENANCE" },
      { date: "2026-03-05", source: "EXPENSE", status: "ACTIVE", debit: 500, expenseCategory: "REPAIRS" }
    ]);
    expect(pct).toBe(10);
  });

  it("returns 0% maintenance when there is no income", () => {
    expect(
      computeMaintenancePercentFromStatement([
        { date: "2026-01-10", source: "EXPENSE", status: "ACTIVE", debit: 100, expenseCategory: "MAINTENANCE" }
      ])
    ).toBe(0);
  });

  it("computes vacancy percent from months without an active lease", () => {
    const pct = computeVacancyPercentFromHistory({
      propertyCreatedAt: "2026-01-01",
      fallbackMonthlyRent: 10_000,
      leases: [
        {
          startDate: "2026-03-01",
          fixedTermEndDate: "2026-12-31",
          monthlyRent: 10_000,
          status: "ACTIVE"
        }
      ],
      statementRows: [{ date: "2026-03-15", source: "INCOME", status: "RECEIVED", credit: 10_000 }]
    });
    // Jan + Feb vacant (20k loss) / 10k income = 200%
    expect(pct).toBe(200);
  });

  it("formats zero and positive percentages", () => {
    expect(formatMetricPercent(0)).toBe("0%");
    expect(formatMetricPercent(12.34)).toBe("12.3%");
  });
});
