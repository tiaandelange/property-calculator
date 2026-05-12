import path from "node:path";
import fs from "node:fs";
import fsAsync from "node:fs/promises";
import multer, { type Multer } from "multer";
import {
  generateStorageBasename,
  isAllowedExtension,
  safeExtensionFromOriginalName
} from "./safeFileNames.js";

/**
 * Secure multer factory.
 *
 *   - On-disk filenames are ALWAYS server-generated UUIDs with a whitelisted
 *     extension. The browser-supplied `originalname` is never used to construct
 *     a path.
 *   - The fileFilter rejects anything whose declared mimetype is not on the
 *     allow-list AND whose extension is not on the allow-list. (Magic-byte
 *     validation happens AFTER multer writes the file — see `mimeSniff.ts`.)
 *   - File size is capped at 10 MiB per upload.
 *   - File COUNT is capped at 1 per request — these endpoints accept a single
 *     `file` field, so any second part is a misuse.
 *   - The originalname is bounded at 255 bytes so a malicious 1 MB filename
 *     can't OOM the request.
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
]);

export interface SecureUploadInstance {
  upload: Multer;
  uploadDir: string;
}

export function createSecureUploadInstance(uploadDir: string): SecureUploadInstance {
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      try {
        const ext = safeExtensionFromOriginalName(file.originalname || "");
        if (!isAllowedExtension(ext)) {
          // Reject at filename generation so multer never writes the bytes.
          return cb(new Error("Unsupported file extension."), "");
        }
        cb(null, generateStorageBasename(ext));
      } catch (err) {
        cb(err as Error, "");
      }
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: 1,
      // Keep field-name length and field-value length small to prevent DoS via
      // multipart form metadata.
      fieldNameSize: 64,
      fieldSize: 1024
    },
    fileFilter: (_req, file, cb) => {
      const mimetype = (file.mimetype || "").toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(mimetype)) return cb(null, false);

      if (typeof file.originalname === "string" && file.originalname.length > 255) {
        return cb(null, false);
      }

      const ext = safeExtensionFromOriginalName(file.originalname || "");
      if (!isAllowedExtension(ext)) return cb(null, false);

      cb(null, true);
    }
  });

  return { upload, uploadDir };
}

/** Delete the temp file written by multer, ignoring any error. */
export async function discardUploadedFile(absolutePath: string | null | undefined): Promise<void> {
  if (!absolutePath) return;
  try {
    await fsAsync.unlink(absolutePath);
  } catch {
    // best-effort cleanup
  }
}

/** Convenience: build the absolute path used at storage time. */
export function buildUploadAbsolutePath(uploadDir: string, basename: string): string {
  // basename was produced by our own generator and is guaranteed safe.
  return path.join(uploadDir, basename);
}
