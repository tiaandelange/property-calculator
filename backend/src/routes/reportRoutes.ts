import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { db } from "../config/db.js";
import { ensureReportsDirectory, getReportsRoot, resolveStoredPdfAbsolute, reportsDirectoryExistsSync, reportsDirectoryWritable } from "../config/reportsPaths.js";
import { isProduction } from "../config/env.js";
import { pdfLibraryLoaded } from "../services/pdf/pdfMakePrinter.js";
import { writePdfDefinitionToFile } from "../services/pdf/writePdfKitDocument.js";
import { buildCalculationReportPdfDefinition } from "../services/pdf/calculationReportPdf.js";
import { buildPropertySummaryPdfDefinition } from "../services/pdf/propertySummaryPdf.js";

export const reportRoutes = Router();

reportRoutes.get("/health", authRequired, async (_req: AuthRequest, res) => {
  try {
    await ensureReportsDirectory();
    const canWrite = await reportsDirectoryWritable();
    const payload: Record<string, unknown> = {
      reportsDirectoryExists: reportsDirectoryExistsSync(),
      canWriteToReportsDirectory: canWrite,
      pdfLibraryLoaded: pdfLibraryLoaded()
    };
    if (!isProduction) payload.reportsDirectoryPath = getReportsRoot();
    else payload.reportsDirectoryPath = "(hidden in production)";
    return res.json(payload);
  } catch (err: any) {
    console.error("[reports] GET /health failed", err?.stack ?? err);
    return res.status(500).json({ message: "Health check failed." });
  }
});

reportRoutes.post("/generate", authRequired, async (req: AuthRequest, res) => {
  try {
    await ensureReportsDirectory();
    const userId = req.userId!;
    const body = req.body ?? {};
    const reportType = String(body.reportType ?? "").trim();
    const scenarioName = typeof body.scenarioName === "string" ? body.scenarioName : null;

    if (!reportType) return res.status(400).json({ message: "reportType is required." });

    let fileBaseName: string;
    let definitionResult:
      | { ok: true; definition: import("pdfmake/interfaces").TDocumentDefinitions }
      | { ok: false; status: number; message: string };
    let calculationId: number | null = null;
    let propertyId: number | null = null;

    if (reportType === "CALCULATION") {
      const calculationIdRaw = body.calculationId;
      const cid = typeof calculationIdRaw === "number" ? calculationIdRaw : Number(calculationIdRaw);
      if (!Number.isFinite(cid)) return res.status(400).json({ message: "calculationId is required for CALCULATION reports." });
      const owned = await db.calculation.findFirst({ where: { id: cid, user_id: userId } });
      if (!owned) return res.status(404).json({ message: "Calculation not found." });
      calculationId = cid;
      definitionResult = await buildCalculationReportPdfDefinition({
        calculationId: cid,
        userId,
        scenarioNameOverride: scenarioName
      });
      fileBaseName = `calculation-${cid}-${Date.now()}.pdf`;
    } else if (reportType === "PROPERTY_SUMMARY") {
      const propertyIdRaw = body.propertyId;
      const pid = typeof propertyIdRaw === "number" ? propertyIdRaw : Number(propertyIdRaw);
      if (!Number.isFinite(pid)) return res.status(400).json({ message: "propertyId is required for PROPERTY_SUMMARY reports." });
      const owned = await db.property.findFirst({ where: { id: pid, userId } });
      if (!owned) return res.status(404).json({ message: "Property not found." });
      propertyId = pid;
      definitionResult = await buildPropertySummaryPdfDefinition({ userId, propertyId: pid, scenarioName });
      fileBaseName = `property-${pid}-${Date.now()}.pdf`;
    } else {
      return res.status(400).json({ message: `Unsupported reportType: ${reportType}` });
    }

    if (!definitionResult.ok) return res.status(definitionResult.status).json({ message: definitionResult.message });

    const absolutePath = path.join(getReportsRoot(), fileBaseName);
    await writePdfDefinitionToFile(definitionResult.definition, absolutePath);

    const stored = await db.storedReport.create({
      data: {
        userId,
        reportType,
        fileName: fileBaseName,
        calculationId,
        propertyId,
        invoiceId: null,
        scenarioName
      }
    });

    return res.status(201).json({
      reportId: stored.id,
      fileName: stored.fileName,
      downloadUrl: `/api/reports/${stored.id}/download`
    });
  } catch (err: any) {
    console.error("[reports] POST /generate failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to generate report." });
  }
});

reportRoutes.get("/:reportId/download", authRequired, async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.reportId);
    if (!Number.isFinite(reportId)) return res.status(400).json({ message: "Invalid report id." });

    const row = await db.storedReport.findFirst({
      where: { id: reportId, userId: req.userId! }
    });
    if (!row) return res.status(404).json({ message: "Report not found." });

    const absolutePath = resolveStoredPdfAbsolute(row.fileName);
    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ message: "PDF file is missing on disk. Generate the report again." });
    }

    const safeName = path.basename(row.fileName).replace(/[^\w.\-]+/g, "_") || "report.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.sendFile(path.resolve(absolutePath));
  } catch (err: any) {
    console.error("[reports] GET /:reportId/download failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to download report." });
  }
});
