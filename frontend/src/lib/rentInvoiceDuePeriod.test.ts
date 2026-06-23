import { describe, expect, it } from "vitest";
import {
  isInGenerationWindow,
  leaseRentDueDateYmd,
  rentDuePeriodCandidates,
  shouldGenerateRentInvoice
} from "./rentInvoiceDuePeriod";

describe("rentInvoiceDuePeriod", () => {
  const daysBefore = 10;
  const rentDueDay = 1;

  it("Scenario A: before generation window — no July invoice on 2026-06-20", () => {
    const july = rentDuePeriodCandidates("2026-06-20", rentDueDay, daysBefore).find((c) => c.periodKey === "2026-07");
    expect(july).toBeDefined();
    expect(isInGenerationWindow("2026-06-20", july!.generationDate)).toBe(false);
    expect(
      shouldGenerateRentInvoice({
        todayYmd: "2026-06-20",
        rentDueDay,
        daysBeforeDue: daysBefore,
        leaseStartYmd: "2026-01-01",
        leaseActive: true,
        invoiceExists: false
      }).generate
    ).toBe(false);
  });

  it("Scenario B: on generation date — July invoice on 2026-06-21", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-06-21",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-01-01",
      leaseActive: true,
      invoiceExists: false
    });
    expect(decision.generate).toBe(true);
    expect(decision.periodKey).toBe("2026-07");
    expect(decision.dueDate).toBe("2026-07-01");
  });

  it("Scenario C: catch-up after offline period — 2026-06-24", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-06-24",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-01-01",
      leaseActive: true,
      invoiceExists: false
    });
    expect(decision.generate).toBe(true);
    expect(decision.periodKey).toBe("2026-07");
  });

  it("Scenario D: duplicate prevention — invoice already exists", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-06-24",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-01-01",
      leaseActive: true,
      invoiceExists: true
    });
    expect(decision.generate).toBe(false);
    expect(decision.reason).toBe("invoice_exists");
  });

  it("Scenario E: lease starts 2026-07-01 — no invoice on 2026-05-21", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-05-21",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-07-01",
      leaseActive: true,
      invoiceExists: false
    });
    expect(decision.generate).toBe(false);
  });

  it("Scenario F: lease starts 2026-07-01 — July invoice on 2026-06-21", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-06-21",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-07-01",
      leaseActive: true,
      invoiceExists: false
    });
    expect(decision.generate).toBe(true);
    expect(decision.periodKey).toBe("2026-07");
  });

  it("Scenario G: inactive lease — no invoice", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-06-21",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-01-01",
      leaseActive: false,
      invoiceExists: false
    });
    expect(decision.generate).toBe(false);
    expect(decision.reason).toBe("lease_inactive");
  });

  it("Scenario H: lease ended before due date", () => {
    const decision = shouldGenerateRentInvoice({
      todayYmd: "2026-06-21",
      rentDueDay,
      daysBeforeDue: daysBefore,
      leaseStartYmd: "2026-01-01",
      leaseEndYmd: "2026-06-15",
      leaseActive: true,
      invoiceExists: false
    });
    expect(decision.generate).toBe(false);
  });

  it("clamps rent due day 31 to shorter months", () => {
    expect(leaseRentDueDateYmd(2026, 2, 31)).toBe("2026-02-28");
    expect(leaseRentDueDateYmd(2024, 2, 31)).toBe("2024-02-29");
  });
});
