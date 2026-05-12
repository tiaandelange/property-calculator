import crypto from "node:crypto";
import path from "node:path";

/**
 * Centralised filename safety helpers.
 *
 * The rules below apply uniformly to every user-influenced filename in the
 * system:
 *   - Storage filenames are ALWAYS server-generated (UUID + short suffix +
 *     whitelisted extension). The caller never controls the bytes on disk.
 *   - Display filenames stored in the DB (e.g. PropertyDocument.fileName) are
 *     sanitised down to a printable, basename-only string with a length cap.
 *   - Content-Disposition header values are built with `buildContentDisposition`
 *     which always emits a strict ASCII fallback plus a UTF-8 form per RFC 6266.
 */

/** Whitelist of file extensions we ever accept on storage. */
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png"
]);

const SAFE_EXT_RE = /^[a-z0-9]{1,8}$/;

/** Strip everything except letters, digits, `.`, `_`, `-`. */
const ASCII_FILENAME_RE = /[^A-Za-z0-9._-]+/g;

/** Convert `MyFile.PDF` → `pdf`, `noext` → `""`, returns lowercase. */
export function safeExtensionFromOriginalName(originalName: string): string {
  const base = path.basename(originalName);
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  const ext = base.slice(idx + 1).toLowerCase();
  return ext;
}

export function isAllowedExtension(ext: string): boolean {
  return SAFE_EXT_RE.test(ext) && ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Generate the on-disk filename for a freshly uploaded file. The caller never
 * influences the bytes — the only attacker-controlled signal is the extension,
 * and we whitelist it before letting it through.
 */
export function generateStorageBasename(ext: string): string {
  const lower = ext.toLowerCase();
  if (!isAllowedExtension(lower)) {
    throw new Error(`Unsafe or unsupported file extension: ${ext}`);
  }
  return `${crypto.randomUUID()}.${lower}`;
}

/**
 * Generate a server-controlled basename for system-produced reports/invoices.
 * Format: `<kind>-<resourceId>-<uuid>.<ext>` so logs remain searchable but
 * collisions are impossible.
 */
export function generateReportBasename(
  kind: "calculation" | "property" | "invoice",
  resourceId: number,
  ext = "pdf"
): string {
  if (!isAllowedExtension(ext)) {
    throw new Error(`Unsafe or unsupported file extension: ${ext}`);
  }
  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    throw new Error("resourceId must be a positive integer.");
  }
  return `${kind}-${resourceId}-${crypto.randomUUID()}.${ext}`;
}

/**
 * Reduce any user-supplied filename to a safe ASCII display string. Strips
 * directories, control characters, leading dots, and caps the length.
 *
 * Returns `fallback` if nothing usable remains.
 */
export function sanitizeDisplayFilename(name: unknown, fallback = "file"): string {
  if (typeof name !== "string") return fallback;
  // Always take only the basename — refuse to honour any directory traversal.
  const baseRaw = path.basename(name);
  // Strip control characters first.
  const noControl = baseRaw.replace(/[\x00-\x1f\x7f]/g, "");
  // Then strip everything outside the safe ASCII set.
  const ascii = noControl.replace(ASCII_FILENAME_RE, "_").replace(/^\.+/, "").slice(0, 120);
  if (!ascii) return fallback;
  return ascii;
}

/**
 * Build a Content-Disposition header value per RFC 6266 with both an ASCII
 * fallback and a UTF-8 form.
 *
 *   filename="invoice-44.pdf"; filename*=UTF-8''invoice-44.pdf
 */
export function buildContentDisposition(input: { displayName: string; fallback: string; inline?: boolean }): string {
  const disposition = input.inline ? "inline" : "attachment";
  const ascii = sanitizeDisplayFilename(input.displayName, input.fallback);
  const utf8 = encodeURIComponent(input.displayName || ascii);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
