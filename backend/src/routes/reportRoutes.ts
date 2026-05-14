import { Router } from "express";
import fs from "node:fs/promises";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { requireDownloadAuth } from "../middleware/downloadAuth.js";
import { db } from "../config/db.js";
import {
  ensureReportsDirectory,
  getReportsRoot,
  resolveStoredPdfAbsoluteOrNull,
  reportsDirectoryExistsSync,
  reportsDirectoryWritable
} from "../config/reportsPaths.js";
import { isProduction } from "../config/env.js";
import { pdfLibraryLoaded } from "../services/pdf/pdfMakePrinter.js";
import { writePdfDefinitionToFile } from "../services/pdf/writePdfKitDocument.js";
import { buildCalculationReportPdfDefinition } from "../services/pdf/calculationReportPdf.js";
import { buildPropertySummaryPdfDefinition } from "../services/pdf/propertySummaryPdf.js";
import { generateReportBasename, buildContentDisposition } from "../utils/safeFileNames.js";
import { buildSignedDownloadUrl, signDownloadParams } from "../utils/downloadSignatures.js";
import path from "node:path";

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

/**
 * Legacy disk-backed PDF generation (Prisma integer ids).
 * @deprecated When the SPA runs on Vercel with Supabase saves, use `POST /api/reports/generate` (see `frontend/api/reports/generate.ts`) for Storage-backed reports.
 */
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
      if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ message: "calculationId is required for CALCULATION reports." });
      const owned = await db.calculation.findFirst({ where: { id: cid, user_id: userId } });
      if (!owned) return res.status(404).json({ message: "Calculation not found." });
      calculationId = cid;
      definitionResult = await buildCalculationReportPdfDefinition({
        calculationId: cid,
        userId,
        scenarioNameOverride: scenarioName
      });
      fileBaseName = generateReportBasename("calculation", cid);
    } else if (reportType === "PROPERTY_SUMMARY") {
      const propertyIdRaw = body.propertyId;
      const pid = typeof propertyIdRaw === "number" ? propertyIdRaw : Number(propertyIdRaw);
      if (!Number.isInteger(pid) || pid <= 0) return res.status(400).json({ message: "propertyId is required for PROPERTY_SUMMARY reports." });
      const owned = await db.property.findFirst({ where: { id: pid, userId } });
      if (!owned) return res.status(404).json({ message: "Property not found." });
      propertyId = pid;
      definitionResult = await buildPropertySummaryPdfDefinition({ userId, propertyId: pid, scenarioName });
      fileBaseName = generateReportBasename("property", pid);
    } else {
      return res.status(400).json({ message: `Unsupported reportType: ${reportType}` });
    }

    if (!definitionResult.ok) return res.status(definitionResult.status).json({ message: definitionResult.message });

    // Resolve under the reports root via the safe resolver so we always write
    // inside the directory we manage, even if a future change pulls part of
    // the basename from user input.
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
      downloadUrl: `/api/reports/${stored.id}/download`
    });
  } catch (err: any) {
    console.error("[reports] POST /generate failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to generate report." });
  }
});

/**
 * Mint a short-lived signed download URL the caller can hand to the browser
 * (e.g. for direct `<a href>` clicks or in-tab navigations).
 */
reportRoutes.post("/:reportId/sign-download", authRequired, async (req: AuthRequest, res) => {
  const reportId = Number(req.params.reportId);
  if (!Number.isInteger(reportId) || reportId <= 0) return res.status(400).json({ message: "Invalid report id." });
  const row = await db.storedReport.findFirst({ where: { id: reportId, userId: req.userId! } });
  if (!row) return res.status(404).json({ message: "Report not found." });
  const parts = signDownloadParams({ userId: req.userId!, kind: "report", resourceId: reportId });
  const url = buildSignedDownloadUrl(`/api/reports/${reportId}/download`, parts);
  return res.json({ url, expiresAt: parts.exp });
});

reportRoutes.get(
  "/:reportId/download",
  requireDownloadAuth("report", "reportId"),
  async (req: AuthRequest, res) => {
    try {
      const reportId = Number(req.params.reportId);

      const row = await db.storedReport.findFirst({
        where: { id: reportId, userId: req.userId! }
      });
      if (!row) return res.status(404).json({ message: "Report not found." });

      const absolutePath = resolveStoredPdfAbsoluteOrNull(row.fileName);
      if (!absolutePath) {
        console.warn("[reports] refusing to serve report outside reports root", { reportId });
        return res.status(404).json({ message: "Report not found." });
      }
      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({ message: "PDF file is missing on disk. Generate the report again." });
      }

      const displayName = `report-${row.id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        buildContentDisposition({ displayName, fallback: "report.pdf" })
      );
      return res.sendFile(absolutePath);
    } catch (err: any) {
      console.error("[reports] GET /:reportId/download failed", err?.stack ?? err);
      return res.status(500).json({ message: "Failed to download report." });
    }
  }
);
