import {
  buildContentDisposition,
  generateReportBasename,
  generateStorageBasename,
  isAllowedExtension,
  safeExtensionFromOriginalName,
  sanitizeDisplayFilename
} from "../../src/utils/safeFileNames";

describe("safeExtensionFromOriginalName", () => {
  test("returns lowercase extension", () => {
    expect(safeExtensionFromOriginalName("report.PDF")).toBe("pdf");
    expect(safeExtensionFromOriginalName("notes.DocX")).toBe("docx");
  });
  test("returns empty for files with no extension or trailing dot", () => {
    expect(safeExtensionFromOriginalName("README")).toBe("");
    expect(safeExtensionFromOriginalName("trailing.")).toBe("");
    expect(safeExtensionFromOriginalName(".hidden")).toBe("");
  });
});

describe("isAllowedExtension", () => {
  test("allow-listed", () => {
    for (const ext of ["pdf", "doc", "docx", "jpg", "jpeg", "png"]) {
      expect(isAllowedExtension(ext)).toBe(true);
    }
  });
  test("everything else rejected", () => {
    for (const ext of ["exe", "sh", "html", "js", "php", "svg", "gif", ""]) {
      expect(isAllowedExtension(ext)).toBe(false);
    }
  });
});

describe("generateStorageBasename", () => {
  test("produces a UUID-shaped, safe basename", () => {
    const name = generateStorageBasename("pdf");
    expect(name).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/);
  });
  test("rejects unsafe extensions", () => {
    expect(() => generateStorageBasename("exe")).toThrow();
    expect(() => generateStorageBasename("../etc")).toThrow();
  });
});

describe("generateReportBasename", () => {
  test("uses server-controlled UUID + the requested kind", () => {
    const name = generateReportBasename("invoice", 44);
    expect(name).toMatch(/^invoice-44-[0-9a-f-]+\.pdf$/);
  });
  test("rejects non-positive ids", () => {
    expect(() => generateReportBasename("invoice", 0)).toThrow();
    expect(() => generateReportBasename("invoice", -1)).toThrow();
  });
});

describe("sanitizeDisplayFilename", () => {
  test("strips directories", () => {
    expect(sanitizeDisplayFilename("/etc/passwd")).toBe("passwd");
    // Backslashes are treated as part of the basename on POSIX, so we rely
    // on the character allowlist to scrub them. Leading dots are stripped.
    expect(sanitizeDisplayFilename("..\\..\\winnt\\system32\\config")).toBe("_.._winnt_system32_config");
  });
  test("strips control characters and replaces other chars", () => {
    expect(sanitizeDisplayFilename("hello\u0000world.pdf")).toBe("helloworld.pdf");
    // Consecutive non-safe characters collapse to a single underscore.
    expect(sanitizeDisplayFilename("My File <1>.pdf")).toBe("My_File_1_.pdf");
  });
  test("returns fallback when nothing usable remains", () => {
    expect(sanitizeDisplayFilename("///", "fallback.pdf")).toBe("fallback.pdf");
    expect(sanitizeDisplayFilename(null, "x.pdf")).toBe("x.pdf");
  });
  test("caps length", () => {
    const long = "a".repeat(500) + ".pdf";
    const out = sanitizeDisplayFilename(long);
    expect(out.length).toBeLessThanOrEqual(120);
  });
});

describe("buildContentDisposition", () => {
  test("emits ASCII filename + UTF-8 form", () => {
    const v = buildContentDisposition({ displayName: "report-1.pdf", fallback: "file.pdf" });
    expect(v).toMatch(/^attachment; filename="report-1.pdf"; filename\*=UTF-8''report-1\.pdf$/);
  });
  test("URL-encodes non-ASCII characters", () => {
    const v = buildContentDisposition({ displayName: "räport.pdf", fallback: "file.pdf" });
    expect(v).toMatch(/filename="r_port.pdf"/);
    expect(v).toMatch(/filename\*=UTF-8''r%C3%A4port\.pdf/);
  });
});
