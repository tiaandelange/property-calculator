import { createRequire } from "node:module";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
// pdfmake is CommonJS. This project is ESM (`"type": "module"`), so we must load
// pdfmake via `createRequire` to avoid default-import interop issues.
// Important: keep the actual `require("pdfmake")` lazy so that a missing module
// yields a handled runtime error (JSON) instead of a Vercel module-load crash.
const req = createRequire(import.meta.url);

type PdfMakeFontDescriptor = { normal: string; bold?: string; italics?: string; bolditalics?: string };
type PdfMakeFonts = Record<string, PdfMakeFontDescriptor>;

let printer: any | null = null;

function getPdfPrinter(): any {
  if (!printer) {
    // Lazy-load pdfmake so failures don't become FUNCTION_INVOCATION_FAILED.
    const PdfPrinter = req("pdfmake") as any;

    // Use PDFKit's built-in Base14 AFM fonts so we don't depend on bundling TTF files.
    // This avoids production crashes when `assets/fonts/**` is missing.
    const helv = req.resolve("pdfkit/js/data/Helvetica.afm");
    const helvBold = req.resolve("pdfkit/js/data/Helvetica-Bold.afm");
    const helvObl = req.resolve("pdfkit/js/data/Helvetica-Oblique.afm");
    const helvBoldObl = req.resolve("pdfkit/js/data/Helvetica-BoldOblique.afm");

    const fonts: PdfMakeFonts = {
      Helvetica: {
        normal: helv,
        bold: helvBold,
        italics: helvObl,
        bolditalics: helvBoldObl
      }
    };

    console.info("[pdfmake] init", {
      runtime: process.env.VERCEL_ENV ?? "local",
      font: "Helvetica",
      helv: Boolean(helv)
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
