import { describe, expect, it } from "vitest";
import {
  accentPrimaryHex,
  buildGlobalPdfTheme,
  validateHexColor
} from "./globalPdfTheme.js";

describe("globalPdfTheme", () => {
  it("maps accent settings to print-friendly primary colours", () => {
    expect(accentPrimaryHex("blue")).toBe("#2563eb");
    expect(accentPrimaryHex("purple")).toBe("#7c5cff");
    expect(accentPrimaryHex("unknown")).toBe("#7c5cff");
  });

  it("falls back on invalid hex values", () => {
    expect(validateHexColor("not-a-color", "#111111")).toBe("#111111");
    expect(validateHexColor("#abc", "#111111")).toBe("#aabbcc");
  });

  it("always uses white PDF background regardless of UI theme", () => {
    const theme = buildGlobalPdfTheme({ accentColor: "teal" });
    expect(theme.backgroundColor).toBe("#ffffff");
    expect(theme.primaryColor).toBe("#0d9488");
    expect(theme.tableHeaderFill).toBe("#ccfbf1");
  });
});
