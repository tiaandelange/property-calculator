import path from "node:path";
import { resolveWithinRoot, resolveWithinRootOrNull } from "../../src/utils/safePaths";

describe("resolveWithinRoot", () => {
  const root = "/srv/app/reports";

  test("accepts a simple basename", () => {
    expect(resolveWithinRoot(root, "report-1.pdf")).toBe(path.resolve(root, "report-1.pdf"));
  });

  test("accepts a basename inside a subdirectory", () => {
    expect(resolveWithinRoot(root, "invoices/inv-1.pdf")).toBe(path.resolve(root, "invoices/inv-1.pdf"));
  });

  test("refuses absolute paths", () => {
    expect(() => resolveWithinRoot(root, "/etc/passwd")).toThrow();
  });

  test("refuses traversal segments", () => {
    expect(() => resolveWithinRoot(root, "../passwd")).toThrow();
    expect(() => resolveWithinRoot(root, "invoices/../../passwd")).toThrow();
  });

  test("refuses null bytes", () => {
    expect(() => resolveWithinRoot(root, "report\u0000.pdf")).toThrow();
  });

  test("refuses empty strings", () => {
    expect(() => resolveWithinRoot(root, "")).toThrow();
  });

  test("OrNull variant returns null instead of throwing", () => {
    expect(resolveWithinRootOrNull(root, "/etc/passwd")).toBeNull();
    expect(resolveWithinRootOrNull(root, "../passwd")).toBeNull();
    expect(resolveWithinRootOrNull(root, "ok.pdf")).toBe(path.resolve(root, "ok.pdf"));
  });
});
