import { describe, expect, it } from "vitest";
import { formatPdfZar, parsePdfZar } from "./pdfFormat.js";

describe("pdfFormat", () => {
  it("formats whole rands without comma decimals", () => {
    const norm = (s: string) => s.replace(/\u00A0/g, " ");
    expect(norm(formatPdfZar(24_016))).toBe("R 24 016");
    expect(norm(formatPdfZar(1_500_000))).toBe("R 1 500 000");
  });

  it("parses en-ZA currency without 100x scaling", () => {
    expect(parsePdfZar("R 24 016")).toBe(24_016);
    expect(parsePdfZar("R 24 016,00")).toBe(24_016);
    expect(parsePdfZar("R 1 500 000,00")).toBe(1_500_000);
  });
});
