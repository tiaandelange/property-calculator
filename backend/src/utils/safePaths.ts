import path from "node:path";

/**
 * Resolve `candidate` (a path supplied by an upstream caller, often originating
 * from a DB row) strictly inside `root`. Used by every file-serving and
 * file-deleting code path so that a malicious or stale DB value cannot make us
 * read/write outside of the directory we manage.
 *
 * Rejection rules:
 *   - Absolute paths are refused. Historical DB rows may still contain absolute
 *     paths from older builds; those rows must be migrated to basenames before
 *     they can be downloaded again.
 *   - Null bytes are refused (defence-in-depth against odd C-bindings).
 *   - The resolved path must equal `root` or live underneath `root` (checked
 *     after `path.resolve` collapses any `..` segments).
 *
 * Returns the absolute, fully-normalised path on success. Throws on any rule
 * violation — callers should treat that as a 404, never echo the message.
 */
export function resolveWithinRoot(root: string, candidate: string): string {
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error("Empty path is not allowed.");
  }
  if (candidate.includes("\0")) {
    throw new Error("Path contains null bytes.");
  }
  if (path.isAbsolute(candidate)) {
    throw new Error("Absolute paths are not allowed.");
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Resolved path escapes the allowed root.");
  }
  return resolved;
}

/** Same contract as `resolveWithinRoot` but returns `null` instead of throwing. */
export function resolveWithinRootOrNull(root: string, candidate: string): string | null {
  try {
    return resolveWithinRoot(root, candidate);
  } catch {
    return null;
  }
}
