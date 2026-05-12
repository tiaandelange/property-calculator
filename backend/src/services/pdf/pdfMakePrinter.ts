import { createRequire } from "node:module";
import { join } from "node:path";
import PdfPrinter from "pdfmake";

/** Resolve vfs relative to backend package root (cwd when running API). */
const nodeRequire = createRequire(join(process.cwd(), "package.json"));

/** npm pdfmake ships embedded Roboto in build/vfs_fonts.js — file paths under examples/fonts are not published. */
const vfs = nodeRequire("pdfmake/build/vfs_fonts.js") as Record<string, string>;

function vfsBuffer(fileName: string): Buffer {
  const data = vfs[fileName];
  if (!data) throw new Error(`pdfmake vfs missing font: ${fileName}`);
  return Buffer.from(data, "base64");
}

const fonts = {
  Roboto: {
    normal: vfsBuffer("Roboto-Regular.ttf"),
    bold: vfsBuffer("Roboto-Medium.ttf"),
    italics: vfsBuffer("Roboto-Italic.ttf"),
    bolditalics: vfsBuffer("Roboto-MediumItalic.ttf")
  }
};

let printer: InstanceType<typeof PdfPrinter> | null = null;

export function getPdfPrinter(): InstanceType<typeof PdfPrinter> {
  if (!printer) printer = new PdfPrinter(fonts as any);
  return printer;
}

export function pdfLibraryLoaded(): boolean {
  try {
    getPdfPrinter();
    return true;
  } catch {
    return false;
  }
}
