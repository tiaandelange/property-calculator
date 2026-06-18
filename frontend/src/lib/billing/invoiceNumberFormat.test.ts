import { describe, expect, it } from "vitest";
import {
  dbStringToFormatKey,
  formatKeyToDbString,
  previewInvoiceNumber
} from "./invoiceNumberFormat";

describe("invoiceNumberFormat", () => {
  const date = new Date(2026, 5, 18);

  it("maps format keys to DB strings and back", () => {
    expect(formatKeyToDbString("INV-YY-###")).toBe("INV-YY-{####}");
    expect(formatKeyToDbString("INV-####")).toBe("INV-{####}");
    expect(formatKeyToDbString("INV-YYMM-###")).toBe("INV-YYMM-{####}");
    expect(dbStringToFormatKey("INV-YY-{####}")).toBe("INV-YY-###");
    expect(dbStringToFormatKey("INV-{####}")).toBe("INV-####");
    expect(dbStringToFormatKey("INV-YYMM-{####}")).toBe("INV-YYMM-###");
  });

  it("previews invoice numbers", () => {
    expect(previewInvoiceNumber("INV-YY-###", 7, date)).toBe("INV-26-007");
    expect(previewInvoiceNumber("INV-####", 7, date)).toBe("INV-0007");
    expect(previewInvoiceNumber("INV-YYMM-###", 7, date)).toBe("INV-2606-007");
    expect(previewInvoiceNumber("INV-YYYY-###", 7, date)).toBe("INV-2026-007");
  });
});
