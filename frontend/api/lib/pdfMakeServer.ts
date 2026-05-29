import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// pdfmake is CommonJS. This project is ESM (`"type": "module"`), so we must load
// pdfmake via `createRequire` to avoid default-import interop issues.
const req = createRequire(import.meta.url);

type PdfMakeFontDescriptor = { normal: string; bold?: string; italics?: string; bolditalics?: string };
type PdfMakeFonts = Record<string, PdfMakeFontDescriptor>;

const FONT_FILES = {
  normal: "Roboto-Regular.ttf",
  bold: "Roboto-Medium.ttf",
  italics: "Roboto-Italic.ttf",
  bolditalics: "Roboto-MediumItalic.ttf"
} as const;

let printer: any | null = null;

/** Resolve committed Roboto TTF paths (shared by invoice + report PDF routes). */
export function resolveLocalPdfFonts(): PdfMakeFontDescriptor {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "../../assets/fonts/pdfmake"),
    join(process.cwd(), "assets", "fonts", "pdfmake"),
    join(process.cwd(), "frontend", "assets", "fonts", "pdfmake")
  ];

  const tried: string[] = [];
  for (const base of candidates) {
    const normal = join(base, FONT_FILES.normal);
    const bold = join(base, FONT_FILES.bold);
    const italics = join(base, FONT_FILES.italics);
    const bolditalics = join(base, FONT_FILES.bolditalics);
    tried.push(normal, bold, italics, bolditalics);
    if ([normal, bold, italics, bolditalics].every((p) => existsSync(p))) {
      return { normal, bold, italics, bolditalics };
    }
  }

  throw new Error(
    `PDF fonts missing. Expected Roboto TTF files under assets/fonts/pdfmake/ (bundled into Vercel function).\nTried:\n  ${tried.join("\n  ")}`
  );
}

/** Shared PdfPrinter instance for invoice and report PDF generation. */
export function getPdfPrinter(): any {
  if (!printer) {
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
      normal: roboto.normal
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

export function resolveLocalPdfFontDirectory(): string {
  const fonts = resolveLocalPdfFonts();
  return dirname(fonts.normal);
}
