import { describe, expect, it } from "vitest";
import { isAbsoluteHttpUrl } from "./pdfBlob";

describe("isAbsoluteHttpUrl", () => {
  it("detects https and http URLs", () => {
    expect(isAbsoluteHttpUrl("https://example.com/x.pdf")).toBe(true);
    expect(isAbsoluteHttpUrl("http://localhost/a")).toBe(true);
  });

  it("returns false for relative API paths", () => {
    expect(isAbsoluteHttpUrl("/api/reports/uuid/download")).toBe(false);
    expect(isAbsoluteHttpUrl("reports/foo")).toBe(false);
  });
});
