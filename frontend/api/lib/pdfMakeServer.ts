import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
// pdfmake is CommonJS. This project is ESM (`"type": "module"`), so we must load
// pdfmake via `createRequire` to avoid default-import interop issues.
// Important: keep the actual `require("pdfmake")` lazy so that a missing module
// yields a handled runtime error (JSON) instead of a Vercel module-load crash.
const req = createRequire(import.meta.url);

type PdfMakeFontDescriptor = { normal: string; bold?: string; italics?: string; bolditalics?: string };
type PdfMakeFonts = Record<string, PdfMakeFontDescriptor>;

let printer: any | null = null;

function resolvePdfmakeRobotoFonts(): PdfMakeFontDescriptor {
  const pkg = req.resolve("pdfmake/package.json");
  const root = dirname(pkg);
  const candidates = [
    join(root, "examples", "fonts"),
    join(root, "src", "fonts"),
    join(root, "build", "fonts")
  ];

  const names = {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf"
  } as const;

  for (const dir of candidates) {
    const normal = join(dir, names.normal);
    const bold = join(dir, names.bold);
    const italics = join(dir, names.italics);
    const bolditalics = join(dir, names.bolditalics);
    if ([normal, bold, italics, bolditalics].every((p) => existsSync(p))) {
      return { normal, bold, italics, bolditalics };
    }
  }

  throw new Error(
    `Roboto fonts not found inside pdfmake package. Tried:\n  ${candidates
      .map((d) => `- ${d}`)
      .join("\n")}`
  );
}

function getPdfPrinter(): any {
  if (!printer) {
    // Lazy-load pdfmake so failures don't become FUNCTION_INVOCATION_FAILED.
    const PdfPrinter = req("pdfmake") as any;

    // Prefer Roboto fonts that ship within the pdfmake npm package.
    // This avoids relying on repo-bundled font files and avoids pdfkit AFM path differences.
    const roboto = resolvePdfmakeRobotoFonts();
    const fonts: PdfMakeFonts = { Roboto: roboto };

    console.info("[pdfmake] init", {
      runtime: process.env.VERCEL_ENV ?? "local",
      font: "Roboto",
      hasNormal: Boolean(roboto.normal)
    });

    printer = new PdfPrinter(fonts);
  }
  return printer;
}

export function renderPdfDefinitionToBuffer(definition: TDocumentDefinitions): Promise<Buffer> {
  const doc = getPdfPrinter().createPdfKitDocument(definition);
  const chunks: Buffer[] = [];
  return new Promise((resolvePromise, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolvePromise(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
