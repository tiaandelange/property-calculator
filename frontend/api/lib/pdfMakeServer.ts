import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// pdfmake is CommonJS. This project is ESM (`"type": "module"`), so we must load
// pdfmake via `createRequire` to avoid default-import interop issues.
const req = createRequire(import.meta.url);

type FontSlot = string | Buffer;
type PdfMakeFontDescriptor = {
  normal: FontSlot;
  bold?: FontSlot;
  italics?: FontSlot;
  bolditalics?: FontSlot;
};

type PdfMakeFonts = Record<string, PdfMakeFontDescriptor>;

const FONT_FILES = {
  normal: "Roboto-Regular.ttf",
  bold: "Roboto-Medium.ttf",
  italics: "Roboto-Italic.ttf",
  bolditalics: "Roboto-MediumItalic.ttf"
} as const;

let printer: any | null = null;

function fontDirectoryCandidates(): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const roots = new Set<string>([process.cwd(), moduleDir, "/var/task", join(process.cwd(), "frontend")]);

  const dirs: string[] = [];
  for (const root of roots) {
    let dir = root;
    for (let depth = 0; depth < 6; depth += 1) {
      dirs.push(join(dir, "assets", "fonts", "pdfmake"));
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return dirs;
}

/** Resolve committed Roboto TTF directory (shared by invoice + report PDF routes). */
export function resolveLocalPdfFontDirectory(): string {
  const tried: string[] = [];
  for (const candidate of fontDirectoryCandidates()) {
    const normal = join(candidate, FONT_FILES.normal);
    tried.push(normal);
    if (
      existsSync(normal) &&
      existsSync(join(candidate, FONT_FILES.bold)) &&
      existsSync(join(candidate, FONT_FILES.italics)) &&
      existsSync(join(candidate, FONT_FILES.bolditalics))
    ) {
      return candidate;
    }
  }

  throw new Error(
    `PDF fonts missing. Expected Roboto TTF files under assets/fonts/pdfmake/ (bundled into Vercel function).\nTried:\n  ${tried.join("\n  ")}`
  );
}

/** Resolve font file paths (for tests and diagnostics). */
export function resolveLocalPdfFonts(): { normal: string; bold: string; italics: string; bolditalics: string } {
  const dir = resolveLocalPdfFontDirectory();
  return {
    normal: join(dir, FONT_FILES.normal),
    bold: join(dir, FONT_FILES.bold),
    italics: join(dir, FONT_FILES.italics),
    bolditalics: join(dir, FONT_FILES.bolditalics)
  };
}

function loadFontsFromDirectory(dir: string): PdfMakeFontDescriptor {
  const read = (name: string) => readFileSync(join(dir, name));
  return {
    normal: read(FONT_FILES.normal),
    bold: read(FONT_FILES.bold),
    italics: read(FONT_FILES.italics),
    bolditalics: read(FONT_FILES.bolditalics)
  };
}

/** Shared PdfPrinter instance for invoice and report PDF generation. */
export function getPdfPrinter(): any {
  if (!printer) {
    const PdfPrinter = req("pdfmake") as any;
    const fontDir = resolveLocalPdfFontDirectory();
    const roboto = loadFontsFromDirectory(fontDir);
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
      fontDir,
      cwd: process.cwd()
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
