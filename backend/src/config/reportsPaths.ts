import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { resolveWithinRoot, resolveWithinRootOrNull } from "../utils/safePaths.js";

/** Override for tests via REPORTS_ROOT_OVERRIDE */
export function getReportsRoot(): string {
  const override = process.env.REPORTS_ROOT_OVERRIDE?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "reports");
}

export async function ensureReportsDirectory(): Promise<void> {
  const root = getReportsRoot();
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(path.join(root, "invoices"), { recursive: true });
}

/**
 * Resolve a stored PDF location strictly inside `getReportsRoot()`.
 *
 * Throws if `relative` is absolute, contains traversal, or otherwise escapes
 * the reports root. Used by every download handler so a malicious/legacy DB
 * row cannot make us serve files from elsewhere on disk.
 */
export function resolveStoredPdfAbsolute(relative: string): string {
  return resolveWithinRoot(getReportsRoot(), relative);
}

/** Same as `resolveStoredPdfAbsolute` but returns `null` on any error. */
export function resolveStoredPdfAbsoluteOrNull(relative: string): string | null {
  return resolveWithinRootOrNull(getReportsRoot(), relative);
}

export async function reportsDirectoryWritable(): Promise<boolean> {
  try {
    await ensureReportsDirectory();
    const probe = path.join(getReportsRoot(), ".write_probe");
    await fs.writeFile(probe, "ok", "utf8");
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

export function reportsDirectoryExistsSync(): boolean {
  try {
    return fsSync.statSync(getReportsRoot()).isDirectory();
  } catch {
    return false;
  }
}
