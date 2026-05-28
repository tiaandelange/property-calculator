import type { VercelRequest, VercelResponse } from "@vercel/node";
import { renderPdfDefinitionToBuffer } from "../lib/pdfMakeServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const definition = {
      info: { title: "Proplytic PDF smoke test" },
      content: [
        { text: "Proplytic PDF smoke test", fontSize: 16, bold: true },
        { text: `Generated: ${new Date().toISOString()}` },
        { text: `Environment: ${process.env.VERCEL_ENV || "local"}` }
      ],
      defaultStyle: { font: "Helvetica", fontSize: 10 }
    } as any;

    const buf = await renderPdfDefinitionToBuffer(definition);
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"proplytic-pdf-smoke-test.pdf\"");
    res.send(buf);
  } catch (e: any) {
    console.error("[reports/pdf-smoke-test] failed", { message: e?.message, stack: e?.stack });
    res.status(500).json({ ok: false, error: "PDF_SMOKE_TEST_FAILED", message: e?.message ?? "Smoke test failed." });
  }
}

