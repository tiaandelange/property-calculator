import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
// pdfmake is CommonJS. This project is ESM (`"type": "module"`), so we must load
// pdfmake via `createRequire` to avoid default-import interop issues.
// Important: keep the actual `require("pdfmake")` lazy so that a missing module
// yields a handled runtime error (JSON) instead of a Vercel module-load crash.
const req = createRequire(import.meta.url);

type PdfMakeFontDescriptor = { normal: string; bold?: string; italics?: string; bolditalics?: string };
type PdfMakeFonts = Record<string, PdfMakeFontDescriptor>;

let printer: any | null = null;

function resolveLocalPdfFonts(): PdfMakeFontDescriptor {
  const candidates = [
    join(process.cwd(), "assets", "fonts", "pdfmake"),
    join(process.cwd(), "frontend", "assets", "fonts", "pdfmake")
  ];

  const names = {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf"
  } as const;

  const tried: string[] = [];
  for (const base of candidates) {
    const normal = join(base, names.normal);
    const bold = join(base, names.bold);
    const italics = join(base, names.italics);
    const bolditalics = join(base, names.bolditalics);
    tried.push(normal, bold, italics, bolditalics);
    if ([normal, bold, italics, bolditalics].every((p) => existsSync(p))) return { normal, bold, italics, bolditalics };
  }

  throw new Error(
    `PDF fonts missing. Expected these files under assets/fonts/pdfmake/ (bundled into Vercel function).\nTried:\n  ${tried.join("\n  ")}`
  );
}

function getPdfPrinter(): any {
  if (!printer) {
    // Lazy-load pdfmake so failures don't become FUNCTION_INVOCATION_FAILED.
    const PdfPrinter = req("pdfmake") as any;

    const roboto = resolveLocalPdfFonts();
    const fonts: PdfMakeFonts = {
      Roboto: {
        normal: roboto.normal,
        bold: roboto.bold,
        italics: roboto.italics,
        bolditalics: roboto.bolditalics
      }
    };

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
