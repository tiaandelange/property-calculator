import fs from "node:fs/promises";

/**
 * Magic-byte sniffing for the allowed-upload set. We sniff the actual file
 * contents AFTER multer has written them to disk because client-supplied
 * `Content-Type` headers are trivially forgeable — a malicious user can claim
 * `application/pdf` and upload an HTML/JS payload.
 *
 * Returned values are deliberately the canonical extension (not a MIME) so the
 * caller can compare against the request's declared extension cheaply.
 */
export type DetectedFileKind = "pdf" | "jpeg" | "png" | "zip" | "ole" | null;

function matchesAt(head: Buffer, offset: number, signature: number[]): boolean {
  if (head.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (head[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Inspect the first 16 bytes of `absolutePath` and return the detected kind.
 *
 * `null` means "not a kind we accept" — the caller MUST treat that as an
 * upload failure and delete the file. Returning `null` instead of throwing
 * keeps the route handler logic simple.
 */
export async function detectFileKind(absolutePath: string): Promise<DetectedFileKind> {
  const fh = await fs.open(absolutePath, "r");
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fh.read(buf, 0, 16, 0);
    const head = buf.subarray(0, bytesRead);

    if (matchesAt(head, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // "%PDF-"
    if (matchesAt(head, 0, [0xff, 0xd8, 0xff])) return "jpeg";
    if (matchesAt(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";

    // ZIP container — covers DOCX / XLSX / PPTX (all Office Open XML formats).
    if (matchesAt(head, 0, [0x50, 0x4b, 0x03, 0x04])) return "zip";
    if (matchesAt(head, 0, [0x50, 0x4b, 0x05, 0x06])) return "zip"; // empty zip
    if (matchesAt(head, 0, [0x50, 0x4b, 0x07, 0x08])) return "zip"; // spanned zip

    // Old OLE compound document — covers .doc/.xls/.ppt.
    if (matchesAt(head, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";

    return null;
  } finally {
    await fh.close();
  }
}

/**
 * Check that the detected on-disk kind is compatible with the file's declared
 * extension. Returns true if and only if the detected kind plausibly matches
 * what the caller said it was sending.
 */
export function detectedKindMatchesExtension(kind: DetectedFileKind, extension: string): boolean {
  if (!kind) return false;
  switch (extension) {
    case "pdf":
      return kind === "pdf";
    case "jpg":
    case "jpeg":
      return kind === "jpeg";
    case "png":
      return kind === "png";
    case "docx":
      return kind === "zip";
    case "doc":
      return kind === "ole";
    default:
      return false;
  }
}
