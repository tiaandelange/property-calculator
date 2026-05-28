import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
// pdfmake is CommonJS. This project is ESM (`"type": "module"`), so we must load
// pdfmake via `createRequire` to avoid default-import interop issues.
// Important: keep the actual `require("pdfmake")` lazy so that a missing module
// yields a handled runtime error (JSON) instead of a Vercel module-load crash.
const req = createRequire(import.meta.url);

const FONT_FILES = ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Italic.ttf", "Roboto-MediumItalic.ttf"] as const;

function fontDirCandidates(): string[] {
  const set = new Set<string>();
  try {
    const r = createRequire(join(process.cwd(), "package.json"));
    const pdfmakePkg = r.resolve("pdfmake/package.json");
    set.add(resolve(dirname(pdfmakePkg), "..", ".."));
  } catch {
    /* ignore */
  }
  set.add(process.cwd());
  set.add(join(process.cwd(), "frontend"));
  return Array.from(set);
}

export function resolveReportPdfFontDir(): string {
  const tried: string[] = [];
  for (const root of fontDirCandidates()) {
    const dir = join(root, "assets", "fonts");
    tried.push(dir);
    if (FONT_FILES.every((f) => existsSync(join(dir, f)))) return dir;
  }
  throw new Error(
    `Roboto TTFs missing for pdfmake. Expected under assets/fonts (Vercel: vercel.json includeFiles). Tried:\n  ${tried.join("\n  ")}`
  );
}

let printer: any | null = null;

function getPdfPrinter(): any {
  if (!printer) {
    // Lazy-load pdfmake so failures don't become FUNCTION_INVOCATION_FAILED.
    const PdfPrinter = req("pdfmake") as any;
    const dir = resolveReportPdfFontDir();
    printer = new PdfPrinter({
      Roboto: {
        normal: join(dir, "Roboto-Regular.ttf"),
        bold: join(dir, "Roboto-Medium.ttf"),
        italics: join(dir, "Roboto-Italic.ttf"),
        bolditalics: join(dir, "Roboto-MediumItalic.ttf")
      }
    });
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
