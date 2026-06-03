import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOGO_CANDIDATE_FILES = [
  "proplytic_logo_300x100.png",
  "proplytic_icon_500x500_nobg.png",
  "proplytic_icon_500x500.png",
  "proplytic-mark.png",
  "proplytic-mark-source.png",
  "proplytic-mark.svg",
  "mark.webp"
] as const;

const LOGO_RELATIVE_DIRS = [
  ["..", "..", "public"],
  ["..", "..", "..", "public"],
  ["public"],
  ["frontend", "public"],
  ["..", "..", "public", "assets", "brand"],
  ["..", "..", "..", "public", "assets", "brand"],
  ["public", "assets", "brand"],
  ["frontend", "public", "assets", "brand"]
] as const;

let cachedLogoDataUrl: string | null | undefined;

function toDataUrl(buffer: Buffer, ext: string): string {
  const mime =
    ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Load bundled Proplytic mark from public assets (server-safe, no remote fetch). */
export function loadProplyticLogoDataUrl(): string | null {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const roots = [moduleDir, process.cwd(), join(process.cwd(), "frontend")];

  for (const root of roots) {
    for (const rel of LOGO_RELATIVE_DIRS) {
      const dir = join(root, ...rel);
      for (const file of LOGO_CANDIDATE_FILES) {
        const path = join(dir, file);
        if (!existsSync(path)) continue;
        try {
          const buf = readFileSync(path);
          const ext = file.endsWith(".webp") ? "webp" : file.endsWith(".svg") ? "svg" : "png";
          cachedLogoDataUrl = toDataUrl(buf, ext);
          return cachedLogoDataUrl;
        } catch {
          /* try next path */
        }
      }
    }
  }

  cachedLogoDataUrl = null;
  return null;
}

export function resetProplyticLogoCacheForTests(): void {
  cachedLogoDataUrl = undefined;
}
