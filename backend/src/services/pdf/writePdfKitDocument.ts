import fsSync from "node:fs";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { getPdfPrinter } from "./pdfMakePrinter.js";

export function writePdfDefinitionToFile(docDefinition: TDocumentDefinitions, absolutePath: string): Promise<void> {
  const printer = getPdfPrinter();
  const doc = printer.createPdfKitDocument(docDefinition);
  return new Promise<void>((resolve, reject) => {
    const stream = fsSync.createWriteStream(absolutePath);
    doc.pipe(stream);
    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));
  });
}
