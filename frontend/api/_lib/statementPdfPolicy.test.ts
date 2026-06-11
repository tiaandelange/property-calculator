import { describe, expect, it } from "vitest";
import {
  statementHasStoredPdf,
  statementPdfStorageKey,
  statementPreviewPdfStorageKey,
  shouldPersistStatementPdf
} from "./statementPdfPolicy";

describe("statementPdfPolicy", () => {
  it("persists PDF only for sent or finalised statuses", () => {
    expect(shouldPersistStatementPdf("DRAFT")).toBe(false);
    expect(shouldPersistStatementPdf("GENERATED")).toBe(false);
    expect(shouldPersistStatementPdf("SENT")).toBe(true);
    expect(shouldPersistStatementPdf("PAID")).toBe(true);
  });

  it("builds storage keys under the invoices bucket path prefix", () => {
    expect(statementPdfStorageKey("u1", "stm-1")).toBe("u1/invoices/tenant-statements/stm-1.pdf");
    expect(statementPreviewPdfStorageKey("u1", "stm-1")).toBe(
      "u1/invoices/tenant-statements/preview/stm-1.pdf"
    );
  });

  it("detects stored PDF metadata", () => {
    expect(
      statementHasStoredPdf({
        pdf_storage_bucket: "invoices",
        pdf_storage_key: "u1/invoices/tenant-statements/x.pdf"
      })
    ).toBe(true);
    expect(statementHasStoredPdf({ pdf_storage_bucket: "invoices", pdf_storage_key: null })).toBe(false);
  });
});
