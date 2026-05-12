import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

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

export function resolveStoredPdfAbsolute(relativeOrAbsolute: string): string {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  return path.join(getReportsRoot(), relativeOrAbsolute);
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
