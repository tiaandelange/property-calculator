import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import type { RecurringExpenseMonthAnchor } from "@prisma/client";
import { db } from "../config/db.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { requireDownloadAuth } from "../middleware/downloadAuth.js";
import { createSecureUploadInstance, discardUploadedFile } from "../utils/uploadStorage.js";
import { detectFileKind, detectedKindMatchesExtension } from "../utils/mimeSniff.js";
import {
  buildContentDisposition,
  safeExtensionFromOriginalName,
  sanitizeDisplayFilename
} from "../utils/safeFileNames.js";
import { resolveWithinRootOrNull } from "../utils/safePaths.js";
import { buildSignedDownloadUrl, signDownloadParams } from "../utils/downloadSignatures.js";
import { sendInvoiceEmail } from "../services/emailService.js";
import { leaseDisplayStatus, isCurrentLeaseStatus } from "../domains/properties/propertyLease.helpers.js";
import {
  IRR_EXPENSE_BASELINE_BOND_RATE_FALLBACK_PERCENT,
  inferMonthlyBondPaymentForExpenseBaseline
} from "../domains/properties/property.bond.helpers.js";
import { computeFinancialSummary } from "../domains/properties/property.financials.service.js";
import { whereActiveExpensesForPortfolioMonthSnapshot } from "../domains/properties/propertyExpenseMonth.helpers.js";
import { buildPropertyCreateInput } from "../domains/properties/property.creation.service.js";
import { buildPropertyUpdateData } from "../domains/properties/property.update.service.js";
import {
  buildPropertyAggregate,
  mapAggregateToLegacyDetail,
  sanitizeAggregateForClient,
  sanitizeInvoiceRow,
  sanitizeDocumentRow
} from "../domains/properties/property.aggregate.service.js";
import {
  buildPortfolioAnalysisOverTime,
  buildPortfolioProjectionIrrCashFlows,
  portfolioProjectionIrrRate,
  portfolioIrrExplainStatus
} from "../domains/properties/property.portfolioIrr.js";
import { getPortfolioProjectionGrowthRates } from "../services/portfolioProjectionDefaults.js";
import {
  buildPropertyStatement,
  getCurrentInvoiceForMonth,
  buildFutureCharges,
  buildRecurringChargesList
} from "../domains/properties/property.statement.service.js";
import {
  expenseDateFromYmd,
  firstDueYmdOnOrAfter,
  materializeDueRecurringExpenses,
  materializeDueRecurringExpensesForProperties
} from "../domains/properties/property.recurringExpenseMaterialize.js";
import { runHistoricalBackfill } from "../domains/properties/property.backfill.service.js";
import { createDraftInvoiceForLease, createDraftInvoiceFromCurrentLease } from "../domains/properties/property.invoice.current.js";
import { applyDepositGrowthForCurrentPropertyLeases, ymNow } from "../domains/properties/property.depositGrowth.service.js";
import { computePropertyBondFinance } from "../domains/properties/property.bond.helpers.js";
import {
  backfillBondStatementRows,
  dueYmdForCalendarMonth,
  findActiveBondExpenseInDueMonth,
  postBondStatementRow
} from "../domains/properties/property.bond.ledger.service.js";
import {
  ensureReportsDirectory,
  getReportsRoot,
  resolveStoredPdfAbsoluteOrNull
} from "../config/reportsPaths.js";
import { writePdfDefinitionToFile } from "../services/pdf/writePdfKitDocument.js";
import { buildInvoicePdfDefinition } from "../services/pdf/invoicePdf.js";

export const ownedPropertiesRoutes = Router();

/**
 * @deprecated Disk + multer property-document uploads — superseded by Supabase Storage
 * (`property-documents` bucket) + `frontend/src/services/documentsSupabase.ts` when the SPA
 * runs with `VITE_SUPABASE_*`. Retained for Express-only deployments and automated tests until
 * full parity sign-off; do not extend for new features.
 *
 * Property-document upload storage root. The directory is private to the
 * server and never exposed to clients — frontends interact with it solely
 * through the `/api/documents/:id/download` endpoint.
 */
const propertyDocDir = path.join(process.cwd(), "uploads/property-documents");

/**
 * Secure multer instance:
 *   - server-generated UUID filenames (never `originalname`)
 *   - allow-listed mime + extension pair (PDF, DOC/DOCX, JPG, PNG)
 *   - 10 MiB cap, 1 file per request, bounded multipart field sizes
 *   - file content is magic-byte sniffed AFTER multer finishes writing
 */
const documentUpload = createSecureUploadInstance(propertyDocDir);

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

function asNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Align calendar-day-only payloads with recurring materialisation (UTC noon) so duplicates aren’t posted. */
function coerceExpenseDateFromBody(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return expenseDateFromYmd(s);
  }
  const d = new Date(raw as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isValidDayOfMonth(v: unknown) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

function parseRecurringExpenseMonthAnchor(body: Record<string, unknown>):
  | { ok: true; anchor: RecurringExpenseMonthAnchor; recurringDayOfMonth: number | null }
  | { ok: false; message: string } {
  const raw = body.recurringMonthAnchor;
  if (raw === "LAST_OF_MONTH") return { ok: true, anchor: "LAST_OF_MONTH", recurringDayOfMonth: null };
  if (raw === "DAY_OF_MONTH") {
    if (!isValidDayOfMonth(body.recurringDayOfMonth)) {
      return {
        ok: false,
        message: "recurringDayOfMonth must be an integer 1–31 when recurringMonthAnchor is DAY_OF_MONTH"
      };
    }
    return { ok: true, anchor: "DAY_OF_MONTH", recurringDayOfMonth: Number(body.recurringDayOfMonth) };
  }
  if (raw === "FIRST_OF_MONTH" || raw == null || raw === "") {
    return { ok: true, anchor: "FIRST_OF_MONTH", recurringDayOfMonth: null };
  }
  return { ok: false, message: "recurringMonthAnchor must be FIRST_OF_MONTH, LAST_OF_MONTH, or DAY_OF_MONTH" };
}

function parseCsvParam(v: unknown) {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function monthLabel(monthIndex1to12: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex1to12 - 1] ?? "";
}

async function assertPropertyOwner(userId: number, propertyId: number) {
  const property = await db.property.findFirst({ where: { id: propertyId, userId } });
  return property;
}

ownedPropertiesRoutes.use(requireAuth);

// =============================================================================
// Phase 5 — Property list / detail / CRUD: the SPA may use Supabase `public.properties`
// when `VITE_SUPABASE_*` is configured. The routes below remain for legacy mode
// (no Supabase) and tooling; do not delete until the full API migration is done.
// =============================================================================

ownedPropertiesRoutes.get("/properties", async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const monthParam = typeof req.query.month === "string" ? req.query.month : null; // YYYY-MM
    const base =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1)
        : now;
    const { start: monthStart, end: monthEnd } = monthBounds(base);
    const properties = await db.property.findMany({
      where: { userId: req.userId! },
      include: {
        leases: { where: { status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }, include: { tenant: true }, orderBy: { createdAt: "desc" } },
        tenants: true,
        incomeEntries: { where: { status: "RECEIVED", incomeDate: { gte: monthStart, lt: monthEnd } } },
        expenses: { where: { status: "ACTIVE", expenseDate: { gte: monthStart, lt: monthEnd } } },
        invoices: { where: { status: { notIn: ["PAID", "CANCELLED"] } } }
      },
      orderBy: { createdAt: "desc" }
    });

    const payload = properties.map((p) => {
      const leasesDisplay = (p.leases as any[]).map((l: any) => ({
        ...l,
        displayStatus: leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })
      }));
      const currentLeaseRows = leasesDisplay.filter((l: any) => isCurrentLeaseStatus(l.displayStatus));
      const activeLease = currentLeaseRows[0] ?? null;
      const monthlyIncomeActual = p.incomeEntries.reduce((a, b) => a + b.amount, 0);
      const combinedLeaseRent = currentLeaseRows.reduce((a: number, l: any) => a + Number(l.monthlyRent ?? 0), 0);
      // If user isn't capturing received income entries yet, fall back to lease rent so KPIs don't show nonsense.
      const monthlyIncome = monthlyIncomeActual > 0 ? monthlyIncomeActual : combinedLeaseRent;
      const monthlyOperatingExpenses = (p.expenses as any[]).filter((e: any) => e.category !== "BOND_PAYMENT").reduce((a, b: any) => a + b.amount, 0);
      const monthlyDebtService = (p.expenses as any[]).filter((e: any) => e.category === "BOND_PAYMENT").reduce((a, b: any) => a + b.amount, 0);
      const monthlyExpenses = monthlyOperatingExpenses + monthlyDebtService;
      const monthlyNOI = monthlyIncome - monthlyOperatingExpenses;
      const monthlyCashFlowAfterDebtService = monthlyIncome - monthlyOperatingExpenses - monthlyDebtService;
      const displayStatus = activeLease ? activeLease.displayStatus : "VACANT";
      const directTenant = p.tenants.find((t) => t.status === "ACTIVE") ?? null;
      const currentTenant = (activeLease?.tenant as any) ?? directTenant;
      const occupancyStatus = currentLeaseRows.length > 0 || directTenant ? "OCCUPIED" : "VACANT";

      const in7 = new Date(now);
      in7.setDate(in7.getDate() + 7);
      const in90 = new Date(now);
      in90.setDate(in90.getDate() + 90);
      const openInvoices = p.invoices as any[];
      const rentOverdue = openInvoices.some((inv: any) => inv.dueDate && new Date(inv.dueDate) < now);
      const rentDueSoon = openInvoices.some((inv: any) => inv.dueDate && new Date(inv.dueDate) >= now && new Date(inv.dueDate) <= in7);

      const leaseExpiringSoon = currentLeaseRows.some((l: any) => {
        const leaseEnd = l.fixedTermEndDate ? new Date(l.fixedTermEndDate) : null;
        return Boolean(leaseEnd && leaseEnd >= now && leaseEnd <= in90);
      });
      const leaseMonthToMonth = currentLeaseRows.some((l: any) => l.displayStatus === "MONTH_TO_MONTH");
      return {
        ...p,
        // Strip the internal `pdfPath` from every nested invoice before this
        // row crosses the API boundary.
        invoices: (p.invoices as any[]).map(sanitizeInvoiceRow),
        tenantStatus: currentLeaseRows.length > 0 ? "Occupied" : "Vacant",
        occupancyStatus,
        leaseDisplayStatus: displayStatus,
        currentLeases: currentLeaseRows,
        currentTenant: currentTenant
          ? { id: currentTenant.id, firstName: currentTenant.firstName, lastName: currentTenant.lastName, email: currentTenant.email, phone: currentTenant.phone }
          : null,
        currentLease: activeLease
          ? {
              id: activeLease.id,
              leaseType: activeLease.leaseType,
              status: activeLease.status,
              displayStatus: activeLease.displayStatus,
              startDate: activeLease.startDate,
              fixedTermEndDate: activeLease.fixedTermEndDate,
              monthlyRent: activeLease.monthlyRent,
              depositAmount: activeLease.depositAmount,
              rentDueDay: activeLease.rentDueDay
            }
          : null,
        allTenantsCount: p.tenants.length,
        monthlyRent: combinedLeaseRent,
        combinedMonthlyLeaseRent: combinedLeaseRent,
        monthlyIncome,
        monthlyOperatingExpenses,
        monthlyDebtService,
        monthlyExpenses,
        monthlyNOI,
        monthlyCashFlowAfterDebtService,
        netCashFlow: monthlyCashFlowAfterDebtService,
        rentOverdue,
        rentDueSoon,
        leaseExpiringSoon,
        leaseMonthToMonth
      };
    });

    const summary = {
      totalProperties: payload.length
    };

    return res.json({ properties: payload, summary });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load properties." });
  }
});

ownedPropertiesRoutes.post("/properties", async (req: AuthRequest, res) => {
  try {
    if (!req.body?.name || !req.body?.propertyType || !req.body?.addressLine1 || !req.body?.city || !req.body?.province) {
      return res.status(400).json({ message: "Missing required property fields (name, propertyType, addressLine1, city, province)." });
    }
    const data = buildPropertyCreateInput(req.body as Record<string, unknown>, req.userId!);
    const created = await db.property.create({ data });

    // If a bond profile is supplied at creation time, auto-post a BOND_PAYMENT row for the current month
    // so the statement + dashboards reflect debt service immediately.
    const hasBondProfile =
      created.monthlyBondPayment != null ||
      created.outstandingBondBalance != null ||
      created.bondAnnualInterestRatePercent != null ||
      created.bondTermYears != null ||
      created.bondStartDate != null ||
      created.bondRemainingTermMonths != null;
    if (hasBondProfile) {
      const now = new Date();
      const preferredDom =
        created.bondStartDate instanceof Date && !Number.isNaN(created.bondStartDate.getTime())
          ? created.bondStartDate.getUTCDate()
          : 1;
      const dueYmd = dueYmdForCalendarMonth(now.getUTCFullYear(), now.getUTCMonth() + 1, preferredDom);
      const existingBondRow = await findActiveBondExpenseInDueMonth(req.userId!, created.id, dueYmd);
      if (!existingBondRow) {
        await postBondStatementRow(req.userId!, created.id, dueYmd);
      }
    }

    return res.status(201).json(created);
  } catch (err: any) {
    console.error("[ownedProperties] POST /properties failed", err?.stack ?? err);
    return res.status(400).json({ message: err?.message ?? "Failed to create property." });
  }
});

ownedPropertiesRoutes.get("/properties/metrics/equity", async (req: AuthRequest, res) => {
  try {
    const properties = await db.property.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" }
    });
    const rows = properties.map((p) => {
      const v = p.currentEstimatedValue ?? null;
      const b = p.outstandingBondBalance ?? null;
      return {
        id: p.id,
        name: p.name,
        addressLine1: p.addressLine1,
        city: p.city,
        province: p.province,
        purchasePrice: p.purchasePrice,
        currentEstimatedValue: v,
        outstandingBondBalance: b,
        equity: v != null && b != null ? v - b : null,
        updatedAt: p.updatedAt
      };
    });
    return res.json({ properties: rows });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/metrics/equity failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load equity metrics." });
  }
});

ownedPropertiesRoutes.patch("/properties/metrics/equity", async (req: AuthRequest, res) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : null;
    if (!updates) return res.status(400).json({ message: "updates[] is required" });

    const updated: any[] = [];
    for (const u of updates) {
      const propertyId = Number(u.propertyId);
      if (!propertyId) continue;
      const currentEstimatedValue = u.currentEstimatedValue != null ? asNumber(u.currentEstimatedValue) : null;
      const outstandingBondBalance = u.outstandingBondBalance != null ? asNumber(u.outstandingBondBalance) : null;
      if (currentEstimatedValue != null && currentEstimatedValue < 0) return res.status(400).json({ message: "currentEstimatedValue must be non-negative" });
      if (outstandingBondBalance != null && outstandingBondBalance < 0) return res.status(400).json({ message: "outstandingBondBalance must be non-negative" });

      const exists = await db.property.findFirst({ where: { id: propertyId, userId: req.userId! } });
      if (!exists) return res.status(403).json({ message: "Cannot update another user's property" });

      updated.push(
        await db.property.update({
          where: { id: propertyId },
          data: { currentEstimatedValue, outstandingBondBalance }
        })
      );
    }

    return res.json({ updatedCount: updated.length });
  } catch (err: any) {
    console.error("[ownedProperties] PATCH /properties/metrics/equity failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to update equity values." });
  }
});

ownedPropertiesRoutes.get("/properties/dashboard-summary", async (req: AuthRequest, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const propertyTypes = parseCsvParam(req.query.propertyTypes);
    const now = new Date();
    const monthParam = typeof req.query.month === "string" ? req.query.month : null; // YYYY-MM
    const base =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1)
        : now;
    const portfolioIrrHorizonRaw =
      typeof req.query.portfolioIrrHorizonYears === "string" ? Number(req.query.portfolioIrrHorizonYears) : NaN;
    const portfolioIrrHorizonYears =
      Number.isFinite(portfolioIrrHorizonRaw) && portfolioIrrHorizonRaw >= 1 && portfolioIrrHorizonRaw <= 50
        ? Math.floor(portfolioIrrHorizonRaw)
        : null;
    const { start: monthStart, end: monthEnd } = monthBounds(base);
    /** Trailing 12 calendar months ending at the selected dashboard month — aligns IRR baseline with statement-style averages. */
    const avgWindowStart = new Date(base.getFullYear(), base.getMonth() - 11, 1);
    const avgWindowEnd = monthEnd;
    const propertyId = req.query.propertyId != null ? Number(req.query.propertyId) : null;
    if (propertyId != null && Number.isNaN(propertyId)) return res.status(400).json({ message: "Invalid propertyId" });

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    const twelveStart = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), 1);
    const twelveEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const whereProperty: any = {
      userId: req.userId!
    };
    if (propertyTypes.length) {
      whereProperty.investmentType = { in: propertyTypes };
    }
    if (propertyId != null) {
      whereProperty.id = propertyId;
    }

    const properties = await db.property.findMany({
      where: whereProperty,
      include: {
        leases: { include: { tenant: true } },
        tenants: true,
        invoices: true,
        documents: true
      },
      orderBy: { createdAt: "desc" }
    });

    await materializeDueRecurringExpensesForProperties(
      req.userId!,
      properties.map((p) => p.id)
    );

    const [incomeMonth, incomeExpectedMonth, expensesMonth, income12, expenses12, incomeAvg12, expenseAvg12] = await Promise.all([
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: monthStart, lt: monthEnd }
        }
      }),
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "EXPECTED",
          incomeDate: { gte: monthStart, lt: monthEnd }
        }
      }),
      db.propertyExpense.findMany({
        where: whereActiveExpensesForPortfolioMonthSnapshot(
          req.userId!,
          properties.map((p) => p.id),
          monthStart,
          monthEnd
        )
      }),
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: twelveStart, lt: twelveEnd }
        }
      }),
      db.propertyExpense.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "ACTIVE",
          expenseDate: { gte: twelveStart, lt: twelveEnd }
        }
      }),
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: avgWindowStart, lt: avgWindowEnd }
        }
      }),
      db.propertyExpense.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "ACTIVE",
          expenseDate: { gte: avgWindowStart, lt: avgWindowEnd }
        }
      })
    ]);

    const typeLabel: Record<string, string> = {
      LONG_TERM_RENTAL: "Long-Term Rental",
      SHORT_TERM_RENTAL: "Short-Term Rental",
      PRIMARY_RESIDENCE: "Primary Residence",
      HOUSE_HACK: "House Hack",
      BRRRR: "BRRRR",
      FLIP: "Flip",
      VACANT_LAND: "Vacant Land",
      COMMERCIAL: "Commercial",
      MIXED_USE: "Mixed Use",
      OTHER: "Other"
    };

    const tenantRequired = (p: any) => {
      const t = p.investmentType ?? "OTHER";
      if (t === "VACANT_LAND" || t === "SHORT_TERM_RENTAL" || t === "FLIP" || t === "PRIMARY_RESIDENCE") return false;
      if (t === "BRRRR") return ["RENTED", "REFINANCED"].includes(p.brrrrStage ?? "");
      return true;
    };

    const byProperty = <T extends { propertyId: number }>(rows: T[]) => {
      const m = new Map<number, T[]>();
      for (const r of rows) m.set(r.propertyId, [...(m.get(r.propertyId) ?? []), r]);
      return m;
    };
    const incomeMonthByProperty = byProperty(incomeMonth as any);
    const expenseMonthByProperty = byProperty(expensesMonth as any);

    const invoicesPaidCurrentMonth = properties.flatMap((p: any) =>
      (p.invoices ?? []).filter(
        (inv: any) =>
          inv.status === "PAID" &&
          new Date(inv.invoiceDate).getTime() >= monthStart.getTime() &&
          new Date(inv.invoiceDate).getTime() < monthEnd.getTime()
      )
    );
    const invoiceIncomeByProperty = new Map<number, number>();
    for (const inv of invoicesPaidCurrentMonth) {
      const pid = Number(inv.propertyId);
      invoiceIncomeByProperty.set(pid, (invoiceIncomeByProperty.get(pid) ?? 0) + Number(inv.total));
    }

    const invoicePaidTotalsAvgWindow = new Map<number, number>();
    for (const p of properties as any[]) {
      let invSum = 0;
      for (const inv of p.invoices ?? []) {
        if (inv.status !== "PAID") continue;
        const t = new Date(inv.invoiceDate).getTime();
        if (t >= avgWindowStart.getTime() && t < avgWindowEnd.getTime()) invSum += Number(inv.total);
      }
      invoicePaidTotalsAvgWindow.set(p.id, invSum);
    }

    const statementMonthlyAverageByProperty = new Map<
      number,
      { avgMonthlyIncome: number; avgMonthlyExpenseTotal: number; leaseIncomeFloorApplied: boolean }
    >();
    let irrLeaseIncomeFloors = 0;
    let irrBondExpenseLifted = 0;
    let irrBondNominalRateAssumed = 0;
    const currentMonthStatementIncomeByProperty = new Map<number, number>();
    for (const p of properties as any[]) {
      const pid = p.id;
      const ledgerMonth = (incomeMonthByProperty.get(pid) ?? []).reduce((a: number, r: any) => a + r.amount, 0);
      currentMonthStatementIncomeByProperty.set(pid, ledgerMonth + (invoiceIncomeByProperty.get(pid) ?? 0));

      const ledgerAvgWindow = (incomeAvg12 as any[]).filter((r) => r.propertyId === pid).reduce((a: number, r: any) => a + r.amount, 0);
      const avgMonthlyIncomeRaw = (ledgerAvgWindow + (invoicePaidTotalsAvgWindow.get(pid) ?? 0)) / 12;

      const contractualLeaseMonthly = (p.leases ?? [])
        .filter((l: any) =>
          isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))
        )
        .reduce((s: number, l: any) => s + Number(l.monthlyRent ?? 0), 0);

      const useLeaseIncomeFloor =
        contractualLeaseMonthly > 0 &&
        p.investmentType !== "SHORT_TERM_RENTAL" &&
        p.investmentType !== "VACANT_LAND";

      const avgMonthlyIncome = useLeaseIncomeFloor
        ? Math.max(avgMonthlyIncomeRaw, contractualLeaseMonthly)
        : avgMonthlyIncomeRaw;

      const leaseIncomeFloorApplied = Boolean(
        useLeaseIncomeFloor && avgMonthlyIncome > avgMonthlyIncomeRaw + 0.01
      );
      if (leaseIncomeFloorApplied) irrLeaseIncomeFloors += 1;

      const exAvg = (expenseAvg12 as any[]).filter((r) => r.propertyId === pid);
      const bondSumAvg = exAvg.filter((e: any) => e.category === "BOND_PAYMENT").reduce((a: number, e: any) => a + e.amount, 0);
      const opSumAvg = exAvg.filter((e: any) => e.category !== "BOND_PAYMENT").reduce((a: number, e: any) => a + e.amount, 0);
      const bondLedgerMonthly = bondSumAvg > 0 ? bondSumAvg / 12 : 0;
      const bondProfileMonthly = Number(p.monthlyBondPayment ?? 0);
      const inferredBond = inferMonthlyBondPaymentForExpenseBaseline(p, base);
      const bondInferredMonthly = inferredBond?.monthlyPayment ?? 0;

      const bondMonthlyAvg = Math.round(
        Math.max(bondLedgerMonthly, bondProfileMonthly, bondInferredMonthly) * 100
      ) / 100;

      if (
        bondInferredMonthly > 0 &&
        bondMonthlyAvg <= bondInferredMonthly + 1e-6 &&
        bondInferredMonthly > Math.max(bondLedgerMonthly, bondProfileMonthly) + 1
      ) {
        irrBondExpenseLifted += 1;
      }
      if (
        inferredBond?.usedFallbackNominalRate &&
        bondInferredMonthly > 0 &&
        Math.abs(bondMonthlyAvg - bondInferredMonthly) < 0.02
      ) {
        irrBondNominalRateAssumed += 1;
      }

      const avgMonthlyExpenseTotal = opSumAvg / 12 + bondMonthlyAvg;

      statementMonthlyAverageByProperty.set(pid, {
        avgMonthlyIncome: Math.round(avgMonthlyIncome * 100) / 100,
        avgMonthlyExpenseTotal: Math.round(avgMonthlyExpenseTotal * 100) / 100,
        leaseIncomeFloorApplied
      });
    }

    const totalProperties = properties.length;
    const propertiesByType: Record<string, number> = {};
    let tenantRequiredProperties = 0;
    let occupiedProperties = 0;
    let vacantRentalProperties = 0;
    let landProperties = 0;
    let shortTermRentalProperties = 0;

    let totalCurrentEstimatedValue = 0;
    let totalOutstandingBondBalance = 0;
    let portfolioEquity = 0;
    let totalPurchasePrice = 0;

    let missingCurrentEstimatedValue = 0;
    let missingOutstandingBondBalance = 0;
    let missingPurchasePrice = 0;
    let missingLeaseDocuments = 0;
    let missingExpenseData = 0;

    let depositsHeld = 0;
    let monthlyRentRoll = 0;
    let monthlyShortTermRentalRevenue = 0;

    const in90 = new Date(now);
    in90.setDate(in90.getDate() + 90);
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);

    let leasesExpiringSoon = 0;
    let leasesMonthToMonth = 0;
    let leasesActiveFixedTerm = 0;
    let leasesCancelledOrTerminated = 0;

    const rentOverdueKeys = new Set<string>();
    const rentDueSoonKeys = new Set<string>();

    const cashFlowByProperty: any[] = [];
    const equityByProperty: any[] = [];
    const leaseTimeline: any[] = [];
    const vacantLandHoldingCosts: any[] = [];
    const shortTermRentalPerformance: any[] = [];

    const warnings: string[] = [];

    // Monthly totals
    const debtServiceFromExpenses = (expensesMonth as any[]).filter((e) => e.category === "BOND_PAYMENT").reduce((a, b) => a + b.amount, 0);
    const totalMonthlyDebtService = debtServiceFromExpenses;
    const totalMonthlyOperatingExpenses = (expensesMonth as any[]).filter((e) => e.category !== "BOND_PAYMENT").reduce((a, b) => a + b.amount, 0);
    const invoiceIncomeMonthTotal = invoicesPaidCurrentMonth.reduce((a: number, inv: any) => a + Number(inv.total), 0);
    const totalMonthlyIncomeReceived =
      (incomeMonth as any[]).reduce((a, b) => a + b.amount, 0) + invoiceIncomeMonthTotal;
    const totalMonthlyIncomeExpectedLedger = (incomeExpectedMonth as any[]).reduce((a, b) => a + b.amount, 0);

    // STR estimated monthly revenue (net) based on property fields
    const strRows = properties.filter((p: any) => p.investmentType === "SHORT_TERM_RENTAL");
    const strNet = strRows.reduce((acc: number, p: any) => {
      const adr = p.averageDailyRate ?? 0;
      const occ = p.occupancyRate ?? 0;
      const nights = p.availableNightsPerMonth ?? 0;
      const gross = adr * occ * nights;
      const platformFee = (p.platformFeePercent ?? 0) / 100;
      const mgmtFee = (p.managementFeePercent ?? 0) / 100;
      const net = gross * (1 - platformFee) - gross * mgmtFee + (p.cleaningFeesMonthly ?? 0);
      return acc + net;
    }, 0);

    /** Contractual rent from active / month-to-month leases — informational only (not merged into received income). */
    const totalMonthlyLeaseRent = properties.reduce((a: number, p: any) => {
      const currentLeasesForProperty = (p.leases ?? []).filter((l: any) =>
        isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))
      );
      return a + currentLeasesForProperty.reduce((s: number, l: any) => s + (l.monthlyRent ?? 0), 0);
    }, 0);

    const totalMonthlyIncome = totalMonthlyIncomeReceived + strNet;
    if (totalMonthlyLeaseRent > 0 && totalMonthlyIncomeReceived === 0) {
      warnings.push(
        "Headline monthly income uses received ledger entries (plus STR estimates). Contractual rent from leases is reported separately until rent is recorded as received."
      );
    }
    const monthlyNOI = totalMonthlyIncome - totalMonthlyOperatingExpenses;
    const monthlyExpensesTotal = totalMonthlyOperatingExpenses + totalMonthlyDebtService;
    const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyOperatingExpenses - totalMonthlyDebtService;

    for (const p of properties as any[]) {
      const t = p.investmentType ?? "OTHER";
      propertiesByType[t] = (propertiesByType[t] ?? 0) + 1;
      if (t === "VACANT_LAND") landProperties += 1;
      if (t === "SHORT_TERM_RENTAL") shortTermRentalProperties += 1;

      if (p.purchasePrice == null || p.purchasePrice <= 0) missingPurchasePrice += 1;
      else totalPurchasePrice += p.purchasePrice;

      if (p.currentEstimatedValue == null) missingCurrentEstimatedValue += 1;
      else totalCurrentEstimatedValue += p.currentEstimatedValue;

      if (p.outstandingBondBalance == null) missingOutstandingBondBalance += 1;
      else totalOutstandingBondBalance += p.outstandingBondBalance;

      if (p.currentEstimatedValue != null && p.outstandingBondBalance != null) {
        portfolioEquity += p.currentEstimatedValue - p.outstandingBondBalance;
      }

      const directTenant = (p.tenants ?? []).find((tt: any) => tt.status === "ACTIVE") ?? null;
      const currentLease = (p.leases ?? []).find((l: any) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))) ?? null;
      const leaseDisplay = currentLease ? leaseDisplayStatus({ status: currentLease.status, fixedTermEndDate: currentLease.fixedTermEndDate }) : null;

      const isTenantRequired = tenantRequired(p);
      if (isTenantRequired) {
        tenantRequiredProperties += 1;
        const occupied = Boolean(directTenant || currentLease);
        if (occupied) occupiedProperties += 1;
        else vacantRentalProperties += 1;
      }

      if (currentLease) {
        // For display counts we keep a single "currentLease" per property,
        // but the portfolio rent roll & deposits should reflect multi-tenant scenarios.
        const currentLeasesForProperty = (p.leases ?? []).filter((l: any) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })));
        depositsHeld += currentLeasesForProperty.reduce((a: number, l: any) => a + (l.depositAmount ?? 0), 0);
        monthlyRentRoll += currentLeasesForProperty.reduce((a: number, l: any) => a + (l.monthlyRent ?? 0), 0);

        if (leaseDisplay === "MONTH_TO_MONTH") leasesMonthToMonth += 1;
        if (currentLease.fixedTermEndDate && currentLease.fixedTermEndDate >= now && currentLease.fixedTermEndDate <= in90) leasesExpiringSoon += 1;
        if (currentLease.leaseType === "FIXED_TERM" && leaseDisplay === "ACTIVE") leasesActiveFixedTerm += 1;
        if (!(p.documents ?? []).length) missingLeaseDocuments += 1;

        leaseTimeline.push({
          propertyId: p.id,
          propertyName: p.name,
          tenantName: currentLease.tenant?.firstName ? `${currentLease.tenant.firstName} ${currentLease.tenant.lastName}` : null,
          fixedTermEndDate: currentLease.fixedTermEndDate,
          displayStatus: leaseDisplay
        });
      }

      leasesCancelledOrTerminated += (p.leases ?? []).filter((l: any) => ["CANCELLED", "TERMINATED"].includes(l.status)).length;

      // Rent due / overdue (invoices)
      const unpaid = (p.invoices ?? []).filter((i: any) => !["PAID", "CANCELLED"].includes(i.status));
      unpaid.forEach((i: any) => {
        const due = new Date(i.dueDate);
        const key = `${i.tenantId}-${due.getFullYear()}-${due.getMonth() + 1}`;
        if (due < now) rentOverdueKeys.add(key);
        else if (due >= now && due <= in7) rentDueSoonKeys.add(key);
      });

      // Per-property cash flow for the current month (best-effort)
      const inc =
        (incomeMonthByProperty.get(p.id) ?? []).reduce((a: number, r: any) => a + r.amount, 0) +
        (invoiceIncomeByProperty.get(p.id) ?? 0);
      const expRows = expenseMonthByProperty.get(p.id) ?? [];
      const opEx = expRows.filter((e: any) => e.category !== "BOND_PAYMENT").reduce((a: number, r: any) => a + r.amount, 0);
      const debt = expRows.filter((e: any) => e.category === "BOND_PAYMENT").reduce((a: number, r: any) => a + r.amount, 0);
      cashFlowByProperty.push({ propertyId: p.id, propertyName: p.name, netCashFlow: inc - opEx - debt });

      const eq = p.currentEstimatedValue != null && p.outstandingBondBalance != null ? p.currentEstimatedValue - p.outstandingBondBalance : null;
      equityByProperty.push({ propertyId: p.id, propertyName: p.name, equity: eq });

      // Land holding costs
      if (t === "VACANT_LAND") {
        const holdingFromRecords = opEx;
        vacantLandHoldingCosts.push({ propertyId: p.id, propertyName: p.name, holdingCostsMonthly: holdingFromRecords });
      }

      // STR performance
      if (t === "SHORT_TERM_RENTAL") {
        const adr = p.averageDailyRate ?? 0;
        const occ = p.occupancyRate ?? 0;
        const nights = p.availableNightsPerMonth ?? 0;
        const gross = adr * occ * nights;
        const platformFee = (p.platformFeePercent ?? 0) / 100;
        const mgmtFee = (p.managementFeePercent ?? 0) / 100;
        const net = gross * (1 - platformFee) - gross * mgmtFee + (p.cleaningFeesMonthly ?? 0);
        monthlyShortTermRentalRevenue += net;
        shortTermRentalPerformance.push({
          propertyId: p.id,
          propertyName: p.name,
          adr,
          occupancyRate: occ,
          availableNightsPerMonth: nights,
          grossRevenue: gross,
          netRevenue: net,
          revpar: nights ? gross / nights : 0
        });
      }

      // Missing expense data heuristic
      if (!(expenseMonthByProperty.get(p.id) ?? []).length && !(incomeMonthByProperty.get(p.id) ?? []).length) {
        missingExpenseData += 1;
      }
    }

    const occupancyRate = tenantRequiredProperties ? occupiedProperties / tenantRequiredProperties : 0;

    // Annual NOI / cap rate (best-effort from 12 months actuals, excluding debt service)
    const annualEffectiveIncome = (income12 as any[]).reduce((a, b) => a + b.amount, 0);
    const annualOperatingExpenses = (expenses12 as any[]).filter((e) => e.category !== "BOND_PAYMENT").reduce((a, b) => a + b.amount, 0);
    const annualNOI = annualEffectiveIncome - annualOperatingExpenses;

    const incomeProducingValue = properties
      .filter((p: any) => !["PRIMARY_RESIDENCE", "VACANT_LAND", "FLIP"].includes(p.investmentType ?? "OTHER"))
      .reduce((a: number, p: any) => a + (p.currentEstimatedValue ?? 0), 0);
    const averageCapRate = incomeProducingValue > 0 ? annualNOI / incomeProducingValue : 0;

    const operatingExpenseRatio = annualEffectiveIncome > 0 ? annualOperatingExpenses / annualEffectiveIncome : 0;

    const rentDue = {
      dueSoon: rentDueSoonKeys.size,
      overdue: rentOverdueKeys.size,
      totalAttention: rentDueSoonKeys.size + rentOverdueKeys.size
    };

    const leases = {
      expiringSoon: leasesExpiringSoon,
      monthToMonth: leasesMonthToMonth,
      activeFixedTerm: leasesActiveFixedTerm,
      cancelledOrTerminated: leasesCancelledOrTerminated
    };

    // Charts: monthlyIncomeExpenses (12 months)
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months: string[] = [];
    const cursor = new Date(twelveStart);
    while (cursor < twelveEnd) {
      months.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const incomeByMonth = new Map<string, number>();
    const opExByMonth = new Map<string, number>();
    const debtByMonth = new Map<string, number>();
    (income12 as any[]).forEach((r) => incomeByMonth.set(monthKey(new Date(r.incomeDate)), (incomeByMonth.get(monthKey(new Date(r.incomeDate))) ?? 0) + r.amount));
    (expenses12 as any[]).forEach((r) => {
      const k = monthKey(new Date(r.expenseDate));
      if (r.category === "BOND_PAYMENT") debtByMonth.set(k, (debtByMonth.get(k) ?? 0) + r.amount);
      else opExByMonth.set(k, (opExByMonth.get(k) ?? 0) + r.amount);
    });
    // Debt service comes from PropertyExpense(BOND_PAYMENT) records
    const estDebtService = 0;
    months.forEach((m) => debtByMonth.set(m, (debtByMonth.get(m) ?? 0) + estDebtService));

    const monthlyIncomeExpenses = months.map((m) => {
      const income = incomeByMonth.get(m) ?? 0;
      const operatingExpenses = opExByMonth.get(m) ?? 0;
      const debtService = debtByMonth.get(m) ?? 0;
      return { month: m, income, operatingExpenses, debtService, netCashFlow: income - operatingExpenses - debtService };
    });

    // Expense breakdown (current month)
    const expenseBreakdownMap = new Map<string, number>();
    (expensesMonth as any[]).forEach((e) => expenseBreakdownMap.set(e.category, (expenseBreakdownMap.get(e.category) ?? 0) + e.amount));
    if (estDebtService) expenseBreakdownMap.set("BOND_PAYMENT", (expenseBreakdownMap.get("BOND_PAYMENT") ?? 0) + estDebtService);
    const expenseBreakdown = Array.from(expenseBreakdownMap.entries()).map(([category, amount]) => ({ category, amount }));

    const propertyTypeAllocation = Object.entries(propertiesByType).map(([type, count]) => ({
      type,
      typeLabel: typeLabel[type] ?? type,
      count
    }));

    // --- Phase 9 specific charts ---
    // last 5 months NOI trend
    const last5Start = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const last5End = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [income5, expense5] = await Promise.all([
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: last5Start, lt: last5End }
        }
      }),
      db.propertyExpense.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "ACTIVE",
          expenseDate: { gte: last5Start, lt: last5End }
        }
      })
    ]);

    const keyYM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const income5ByYM = new Map<string, number>();
    income5.forEach((r: any) => income5ByYM.set(keyYM(new Date(r.incomeDate)), (income5ByYM.get(keyYM(new Date(r.incomeDate))) ?? 0) + r.amount));
    const invoicesPaidLast5 = properties.flatMap((p: any) =>
      (p.invoices ?? []).filter(
        (inv: any) =>
          inv.status === "PAID" &&
          new Date(inv.invoiceDate).getTime() >= last5Start.getTime() &&
          new Date(inv.invoiceDate).getTime() < last5End.getTime()
      )
    );
    for (const inv of invoicesPaidLast5) {
      const k = keyYM(new Date(inv.invoiceDate));
      income5ByYM.set(k, (income5ByYM.get(k) ?? 0) + Number(inv.total));
    }
    const opEx5ByYM = new Map<string, number>();
    expense5
      .filter((r: any) => r.category !== "BOND_PAYMENT")
      .forEach((r: any) => opEx5ByYM.set(keyYM(new Date(r.expenseDate)), (opEx5ByYM.get(keyYM(new Date(r.expenseDate))) ?? 0) + r.amount));

    const strNetByMonth = (ym: string) => {
      // assume same monthly STR net each month (until STR has time-series entries)
      return strNet;
    };

    const leaseRentEstimatedMonthly = properties.reduce((acc: number, p: any) => {
      const lease = (p.leases ?? []).find((l: any) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })));
      return acc + (lease?.monthlyRent ?? 0);
    }, 0);

    const months5: { ym: string; label: string }[] = [];
    const cur = new Date(last5Start);
    while (cur < last5End) {
      months5.push({ ym: keyYM(cur), label: monthLabel(cur.getMonth() + 1) });
      cur.setMonth(cur.getMonth() + 1);
    }

    const opExValues = months5.map((m) => opEx5ByYM.get(m.ym)).filter((v): v is number => typeof v === "number");
    const avgOpEx = opExValues.length ? opExValues.reduce((a, b) => a + b, 0) / opExValues.length : 0;
    if (!opExValues.length) warnings.push("No expenses captured yet. NOI may be overstated.");

    const monthlyNOITrend = months5.map((m) => {
      const incomeActual = income5ByYM.get(m.ym) ?? 0;
      const expensesActual = opEx5ByYM.get(m.ym);
      const estimatedExpenses = expensesActual == null;
      const operatingExpenses = expensesActual == null ? avgOpEx : expensesActual;

      // income estimation: if no actual income, use lease rent + STR net estimate
      const estimatedIncome = incomeActual === 0;
      const income = incomeActual || (leaseRentEstimatedMonthly + strNetByMonth(m.ym));

      const noi = income - operatingExpenses;
      return {
        month: m.ym,
        label: m.label,
        income,
        operatingExpenses,
        noi,
        estimatedIncome,
        estimatedExpenses
      };
    });

    // composition chart (current month)
    const compositionMap = new Map<string, { category: string; type: "income" | "expense"; amount: number }>();
    const addComp = (category: string, type: "income" | "expense", amount: number) => {
      if (!amount || amount <= 0) return;
      const key = `${type}:${category}`;
      const existing = compositionMap.get(key);
      if (existing) existing.amount += amount;
      else compositionMap.set(key, { category, type, amount });
    };

    // income categories mapping
    (incomeMonth as any[]).forEach((r) => {
      if (r.category === "RENT") addComp("Rental Income", "income", r.amount);
      else if (r.category === "UTILITIES_RECOVERY") addComp("Utility Recoveries", "income", r.amount);
      else if (r.category === "DEPOSIT") addComp("Other Income", "income", r.amount);
      else addComp("Other Income", "income", r.amount);
    });
    invoicesPaidCurrentMonth.forEach((inv: any) => addComp("Invoice payments", "income", Number(inv.total)));
    if (strNet > 0) addComp("Short-Term Rental Income", "income", strNet);

    // expense categories mapping
    (expensesMonth as any[]).forEach((e) => {
      const amt = e.amount;
      const cat = e.category;
      if (cat === "RATES_TAXES") addComp("Rates & Taxes", "expense", amt);
      else if (cat === "WATER") addComp("Water", "expense", amt);
      else if (cat === "ELECTRICITY") addComp("Electricity", "expense", amt);
      else if (cat === "LEVIES") addComp("Levies", "expense", amt);
      else if (cat === "INSURANCE") addComp("Insurance", "expense", amt);
      else if (cat === "MAINTENANCE") addComp("Maintenance", "expense", amt);
      else if (cat === "REPAIRS") addComp("Repairs", "expense", amt);
      else if (cat === "MANAGEMENT_FEES") addComp("Management Fees", "expense", amt);
      else if (cat === "BOND_PAYMENT") addComp("Debt Service / Bond Payments", "expense", amt);
      else addComp("Other Expenses", "expense", amt);
    });

    // STR expense estimates from property fields (platform/mgmt/utilities) – shown as composition even if not in expenses table
    strRows.forEach((p: any) => {
      const adr = p.averageDailyRate ?? 0;
      const occ = p.occupancyRate ?? 0;
      const nights = p.availableNightsPerMonth ?? 0;
      const gross = adr * occ * nights;
      const platformFee = gross * ((p.platformFeePercent ?? 0) / 100);
      const mgmtFee = gross * ((p.managementFeePercent ?? 0) / 100);
      addComp("Platform Fees", "expense", platformFee);
      addComp("Management Fees", "expense", mgmtFee);
      addComp("Cleaning", "expense", p.cleaningFeesMonthly ?? 0);
      addComp("Utilities", "expense", p.monthlyUtilities ?? 0);
    });

    const incomeExpenseComposition = Array.from(compositionMap.values()).filter((r) => r.amount > 0);

    // --- KPI: true cash-on-cash ROI ---
    const annualPreTaxCashFlow = monthlyNOI * 12 - totalMonthlyDebtService * 12;

    const numMoney = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const estimateCashInvested = (p: any): number | null => {
      const purchasePrice = numMoney(p.purchasePrice);
      if (purchasePrice == null || purchasePrice <= 0) return null;

      const bondBal = numMoney(p.outstandingBondBalance) ?? 0;
      const financed = Math.min(Math.max(0, bondBal), purchasePrice);
      const deposit = Math.max(0, purchasePrice - financed);

      const transferCosts = numMoney(p.transferCosts) ?? 0;
      const bondCosts = numMoney(p.bondCosts) ?? 0;
      const renovations = numMoney(p.rehabBudget) ?? 0;
      const furnishings = numMoney(p.furnishingValue) ?? 0;

      return deposit + transferCosts + bondCosts + renovations + furnishings;
    };

    /** IRR needs CF₀ even when explicit cash invested fields are sparse — equity / deposit fallbacks last. */
    const estimateCashInvestedForIrr = (p: any): number | null => {
      const explicit = numMoney(p.totalCashInvested);
      if (explicit != null && explicit > 0) return explicit;

      const base = estimateCashInvested(p);
      if (base != null && base > 0) return base;

      const v = numMoney(p.currentEstimatedValue);
      const bond = numMoney(p.outstandingBondBalance) ?? 0;
      if (v != null && v > 0) {
        const equity = v - bond;
        if (equity > 1) return equity;
      }

      const pp = numMoney(p.purchasePrice);
      if (pp != null && pp > 0) {
        const financed = Math.min(Math.max(0, bond), pp);
        const deposit = Math.max(0, pp - financed);
        if (deposit > 1) return deposit;
        return Math.max(pp * 0.15, 1);
      }

      return null;
    };

    let estimatedCashInvestedCount = 0;
    let missingCashInvestedCount = 0;
    const totalCashInvested = (properties as any[]).reduce((sum, p) => {
      const explicit = numMoney(p.totalCashInvested);
      if (explicit != null && explicit > 0) return sum + explicit;

      const est = estimateCashInvested(p);
      if (est != null && est > 0) {
        estimatedCashInvestedCount += 1;
        return sum + est;
      }

      missingCashInvestedCount += 1;
      return sum;
    }, 0);

    if (missingCashInvestedCount) warnings.push(`Missing cash invested for ${missingCashInvestedCount} properties`);
    if (estimatedCashInvestedCount) {
      warnings.push(
        `Estimated cash invested for ${estimatedCashInvestedCount} properties using purchase price − bond + (transfer + bond + renovation + furnishing costs where available). Add “Total cash invested” for exact ROI/IRR.`
      );
    }

    const cashOnCash = totalCashInvested > 0 ? annualPreTaxCashFlow / totalCashInvested : null;
    const classification =
      cashOnCash == null
        ? "Insufficient data"
        : cashOnCash < 0
          ? "Deficit"
          : cashOnCash < 0.05
            ? "Weak"
            : cashOnCash < 0.08
              ? "Acceptable"
              : cashOnCash < 0.12
                ? "Strong"
                : "Very strong, check assumptions";

    // --- KPI: portfolio IRR (projected cash flows + growth; bisection matches NPV = Σ CFₜ/(1+r)ᵗ ) ---
    const projectionGrowth = await getPortfolioProjectionGrowthRates(db);
    const sellCostDefault = 5;
    const appreciationDefault = 5;
    const defaultHoldingYears = 10;

    const irrBuilt = buildPortfolioProjectionIrrCashFlows({
      properties,
      expenseMonthByProperty,
      statementMonthlyAverageByProperty,
      currentMonthStatementIncomeByProperty,
      growth: projectionGrowth,
      estimateCashInvested: estimateCashInvestedForIrr,
      appreciationDefaultPercent: appreciationDefault,
      sellCostDefaultPercent: sellCostDefault,
      defaultHoldingYears,
      projectionAsOf: base,
      uniformHoldingYears: portfolioIrrHorizonYears
    });

    const irrCashFlows = irrBuilt.cashFlows;
    const holdingYears = irrBuilt.holdingPeriodYearsMax;
    const irrAssumptions = [
      ...(irrLeaseIncomeFloors > 0
        ? [
            `${irrLeaseIncomeFloors} propert${irrLeaseIncomeFloors === 1 ? "y" : "ies"}: IRR rental income baseline uses max(trailing‑12 received income + paid invoices, current contractual lease rent) when the ledger average would understate contracted rent — aligned with lease rent minus bond and expenses.`
          ]
        : []),
      ...(irrBondExpenseLifted > 0
        ? [
            `${irrBondExpenseLifted} propert${irrBondExpenseLifted === 1 ? "y" : "ies"}: IRR bond expense uses max(trailing‑12 bond ledger average, “Monthly bond payment”, amortising instalment from balance & rate/term) when the amortised instalment exceeds ledger/profile — avoids understating debt service.`
          ]
        : []),
      ...(irrBondNominalRateAssumed > 0
        ? [
            `${irrBondNominalRateAssumed} propert${irrBondNominalRateAssumed === 1 ? "y" : "ies"}: Bond nominal rate was blank — amortised instalment used ${IRR_EXPENSE_BASELINE_BOND_RATE_FALLBACK_PERCENT}% p.a. as a placeholder. Set “Bond interest rate” on the property for accuracy.`
          ]
        : []),
      ...irrBuilt.assumptions,
      "CF₀ uses total cash invested when set; otherwise purchase-based estimate; otherwise equity (value − bond) or a deposit proxy so IRR can be computed."
    ];
    const irrAttempt =
      irrBuilt.eligiblePropertyCount > 0 &&
      irrCashFlows.length >= 2 &&
      irrCashFlows[0] < -1e-9 &&
      irrCashFlows.slice(1).some((x) => Math.abs(x) > 1e-9);
    const irr = irrAttempt ? portfolioProjectionIrrRate(irrCashFlows) : null;
    if (irrAttempt && irr == null) warnings.push("Insufficient data to calculate IRR (cash flows do not produce a solvable IRR).");

    const irrExplain = portfolioIrrExplainStatus({
      filteredPropertyCount: properties.length,
      eligiblePropertyCount: irrBuilt.eligiblePropertyCount,
      cashFlows: irrCashFlows,
      irrAttempted: irrAttempt,
      rateFound: irr != null
    });

    const portfolioIrrDiagnostics = {
      statusCode: irrExplain.code,
      statusMessage: irrExplain.message,
      filteredPropertyCount: properties.length,
      eligiblePropertyCount: irrBuilt.eligiblePropertyCount,
      irrSolveAttempted: irrAttempt,
      irrRatePercent: irr == null ? null : Math.round(irr * 100 * 100) / 100,
      cf0: irrExplain.cf0,
      yearlyCashFlows: irrExplain.yearlyCashFlows,
      sumUndiscountedCashFlows: irrExplain.sumUndiscounted,
      holdingHorizonYears: holdingYears,
      propertyInputs: irrBuilt.eligibleInputs
    };

    const portfolioAnalysisOverTimeBuilt = buildPortfolioAnalysisOverTime({
      properties,
      statementMonthlyAverageByProperty,
      currentMonthStatementIncomeByProperty,
      expenseMonthByProperty,
      growth: projectionGrowth,
      appreciationDefaultPercent: appreciationDefault,
      sellCostDefaultPercent: sellCostDefault,
      projectionAsOf: base,
      totalCashInvested,
      estimateCashInvestedForIrr
    });

    const charts = {
      valueDebtEquity: {
        totalCurrentEstimatedValue,
        totalOutstandingBondBalance,
        portfolioEquity
      },
      monthlyIncomeExpenses,
      expenseBreakdown,
      propertyTypeAllocation,
      cashFlowByProperty: cashFlowByProperty.sort((a, b) => b.netCashFlow - a.netCashFlow),
      equityByProperty: equityByProperty.sort((a, b) => (b.equity ?? -Infinity) - (a.equity ?? -Infinity)),
      leaseTimeline: leaseTimeline.sort((a, b) => (a.fixedTermEndDate ? new Date(a.fixedTermEndDate).getTime() : Infinity) - (b.fixedTermEndDate ? new Date(b.fixedTermEndDate).getTime() : Infinity)),
      shortTermRentalPerformance,
      vacantLandHoldingCosts,

      monthlyNOITrend,
      incomeExpenseComposition
    };

    const kpiStatus = (value: number) => (value < 0 ? "negative" : "positive");

    const response = {
      filters: { propertyTypes, propertyId, month: monthParam ?? null, portfolioIrrHorizonYears },
      kpis: {
        monthlyNOI: {
          value: monthlyNOI,
          status: kpiStatus(monthlyNOI),
          operatingIncome: totalMonthlyIncome,
          operatingIncomeActualReceived: totalMonthlyIncomeReceived + strNet,
          operatingIncomeExpectedFromLedger: totalMonthlyIncomeExpectedLedger,
          contractualMonthlyRentFromLeases: totalMonthlyLeaseRent,
          operatingIncomeProjectedFromLeases: totalMonthlyLeaseRent + strNet,
          operatingExpenses: totalMonthlyOperatingExpenses,
          explanation:
            "Income less operating expenses, before debt service. Headline income is received ledger entries plus STR field estimates — not contractual lease rent unless recorded as received."
        },
        monthlyExpenses: {
          value: monthlyExpensesTotal,
          operatingExpenses: totalMonthlyOperatingExpenses,
          debtService: totalMonthlyDebtService,
          explanation: "Operating costs plus bond repayments."
        },
        trueCashOnCashROI: {
          valuePercent: cashOnCash == null ? null : cashOnCash * 100,
          annualPreTaxCashFlow,
          totalCashInvested: totalCashInvested || null,
          classification,
          explanation: "Annual pre-tax cash flow divided by actual cash invested."
        },
        portfolioIRR: {
          valuePercent: irr == null ? null : Math.round(irr * 100 * 100) / 100,
          cashFlows: irrCashFlows,
          holdingPeriodYears: holdingYears,
          projectionGrowth,
          assumptions: irrAssumptions,
          canCalculate: irr != null,
          diagnostics: portfolioIrrDiagnostics,
          explanation:
            "Portfolio IRR — best long-term return metric. Uses each property’s trailing-12-month statement average income (received ledger + paid invoices) and average expenses (including bond) as Year 1 cash-flow inputs, then applies admin income/expense growth and exit value. IRR solves 0 = CF₀ + CF₁/(1+r)¹ + … + CFₙ/(1+r)ⁿ with CF₀ negative (cash invested) and CFₙ including final-year operating cash plus exit proceeds."
        },
        portfolioAnalysisOverTime: {
          projectionGrowth,
          appreciationDefaultPercent: appreciationDefault,
          columns: portfolioAnalysisOverTimeBuilt.columns,
          bondHorizonCapYears: portfolioAnalysisOverTimeBuilt.bondHorizonCapYears,
          analysisLimitedByBondSchedule: portfolioAnalysisOverTimeBuilt.limitedByBondSchedule,
          explanation:
            "Operating rows sum each property’s projection baseline (same as portfolio IRR: expected monthly when both set; otherwise trailing‑12 averages with lease income floor and bond max logic), escalated annually by admin rental vs expense growth. Property values compound per asset appreciation (default where blank). Loan balances amortise month‑by‑month when nominal rate and payment resolve; otherwise the current outstanding balance is carried. Cash‑on‑cash uses dashboard total cash invested as denominator. Column titles use calendar ownership years from the earliest purchase date in the current filter (when set); otherwise they stay projection years 1…30. Time horizons stop at the longest resolved bond payoff in the filter (bond term + start date, or manual months remaining); unmortgaged portfolios keep milestones through 30 years. IRR row: internal rate of return on the same IRR-eligible subset as the headline portfolio IRR (cash invested + positive value), assuming every eligible asset is sold at the end of that column’s horizon year with proportional operating cash flows through that year."
        },
        totalProperties: {
          value: totalProperties,
          breakdown: {
            occupied: occupiedProperties,
            vacant: vacantRentalProperties,
            land: landProperties,
            shortTerm: shortTermRentalProperties
          }
        }
      },
      charts: {
        monthlyNOITrend,
        incomeExpenseComposition
      },
      warnings
    };

    // Keep legacy fields for existing pages that may still read them
    return res.json({
      ...response,
      totalProperties,
      propertiesByType,
      tenantRequiredProperties,
      occupiedProperties,
      vacantRentalProperties,
      landProperties,
      shortTermRentalProperties,
      occupancyRate,

      totalCurrentEstimatedValue,
      totalOutstandingBondBalance,
      portfolioEquity,
      totalPurchasePrice,

      monthlyRentRoll,
      monthlyShortTermRentalRevenue,
      totalMonthlyIncome,
      totalMonthlyIncomeReceived,
      totalMonthlyIncomeExpectedLedger,
      contractualMonthlyRentFromLeases: totalMonthlyLeaseRent,
      totalMonthlyOperatingExpenses,
      totalMonthlyDebtService,
      monthlyNetCashFlow,

      annualNOI,
      averageCapRate,
      averageGrossYield: 0,
      averageNetYield: 0,
      operatingExpenseRatio,

      depositsHeld,

      rentDue,
      leases,

      missingData: {
        missingCurrentEstimatedValue,
        missingOutstandingBondBalance,
        missingPurchasePrice,
        missingLeaseDocuments,
        missingExpenseData
      },
      charts
    });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/dashboard-summary failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load dashboard summary." });
  }
});

// TENANTS (directory + profiles)
ownedPropertiesRoutes.get("/tenants", async (req: AuthRequest, res) => {
  try {
    const propertyId = req.query.propertyId != null ? Number(req.query.propertyId) : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    if (propertyId != null && Number.isNaN(propertyId)) return res.status(400).json({ message: "Invalid propertyId" });

    const tenants = await db.tenant.findMany({
      where: {
        userId: req.userId!,
        ...(propertyId != null ? { propertyId } : {}),
        ...(status ? { status: status as any } : {})
      },
      include: { property: true },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ tenants });
  } catch (err: any) {
    console.error("[ownedProperties] GET /tenants failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load tenants." });
  }
});

ownedPropertiesRoutes.post("/tenants", async (req: AuthRequest, res) => {
  try {
    if (!req.body?.firstName || !req.body?.lastName) return res.status(400).json({ message: "firstName and lastName are required" });
    const propertyId = req.body.propertyId != null ? Number(req.body.propertyId) : null;
    if (propertyId != null) {
      const property = await assertPropertyOwner(req.userId!, propertyId);
      if (!property) return res.status(404).json({ message: "Property not found." });
    }

    const created = await db.tenant.create({
      data: {
        userId: req.userId!,
        propertyId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email ?? null,
        phone: req.body.phone ?? null,
        idNumber: req.body.idNumber ?? null,
        emergencyContactName: req.body.emergencyContactName ?? null,
        emergencyContactPhone: req.body.emergencyContactPhone ?? null,
        status: req.body.status ?? "ACTIVE"
      }
    });
    return res.status(201).json({ tenant: created });
  } catch (err: any) {
    console.error("[ownedProperties] POST /tenants failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to create tenant." });
  }
});

ownedPropertiesRoutes.get("/tenants/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await db.tenant.findFirst({
      where: { id, userId: req.userId! },
      include: { property: true, leases: { include: { property: true }, orderBy: { createdAt: "desc" } } }
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    const currentLease = tenant.leases.find((l) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })));
    return res.json({
      tenant,
      currentLease: currentLease
        ? { ...currentLease, displayStatus: leaseDisplayStatus({ status: currentLease.status, fixedTermEndDate: currentLease.fixedTermEndDate }) }
        : null
    });
  } catch (err: any) {
    console.error("[ownedProperties] GET /tenants/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load tenant." });
  }
});

ownedPropertiesRoutes.put("/tenants/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await db.tenant.findFirst({ where: { id, userId: req.userId! }, include: { leases: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const nextPropertyId = req.body.propertyId !== undefined ? (req.body.propertyId == null ? null : Number(req.body.propertyId)) : undefined;
    if (nextPropertyId !== undefined && nextPropertyId != null) {
      const property = await assertPropertyOwner(req.userId!, nextPropertyId);
      if (!property) return res.status(404).json({ message: "Property not found." });
    }

    if (nextPropertyId !== undefined && nextPropertyId !== tenant.propertyId) {
      const currentLease = await db.lease.findFirst({
        where: { userId: req.userId!, tenantId: tenant.id, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
      });
      if (currentLease && currentLease.propertyId !== nextPropertyId) {
        return res.status(400).json({ message: "Tenant has an active lease. Cancel or terminate the current lease before moving the tenant." });
      }
    }

    const updated = await db.tenant.update({
      where: { id },
      data: {
        firstName: req.body.firstName ?? tenant.firstName,
        lastName: req.body.lastName ?? tenant.lastName,
        email: req.body.email !== undefined ? req.body.email : tenant.email,
        phone: req.body.phone !== undefined ? req.body.phone : tenant.phone,
        idNumber: req.body.idNumber !== undefined ? req.body.idNumber : tenant.idNumber,
        emergencyContactName: req.body.emergencyContactName !== undefined ? req.body.emergencyContactName : tenant.emergencyContactName,
        emergencyContactPhone: req.body.emergencyContactPhone !== undefined ? req.body.emergencyContactPhone : tenant.emergencyContactPhone,
        status: req.body.status ?? tenant.status,
        propertyId: nextPropertyId === undefined ? tenant.propertyId : nextPropertyId
      }
    });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] PUT /tenants/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to update tenant." });
  }
});

ownedPropertiesRoutes.delete("/tenants/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await db.tenant.findFirst({ where: { id, userId: req.userId! }, include: { leases: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    if (tenant.leases.length) {
      const updated = await db.tenant.update({ where: { id }, data: { status: "PAST" } });
      return res.json({ message: "Tenant marked as past (historical leases retained).", tenant: updated });
    }
    await db.tenant.delete({ where: { id } });
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    console.error("[ownedProperties] DELETE /tenants/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to delete tenant." });
  }
});

ownedPropertiesRoutes.get("/properties/:id/aggregate", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const monthQ = typeof req.query.month === "string" ? req.query.month : undefined;
    const agg = await buildPropertyAggregate(req.userId!, id, { financialSummaryMonth: monthQ });
    if (!agg) return res.status(404).json({ message: "Property not found" });
    return res.json(sanitizeAggregateForClient(agg));
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/:id/aggregate failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load property aggregate." });
  }
});

ownedPropertiesRoutes.get("/properties/:id", async (req: AuthRequest, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const id = Number(req.params.id);
    const monthQ = typeof req.query.month === "string" ? req.query.month : undefined;
    const agg = await buildPropertyAggregate(req.userId!, id, { financialSummaryMonth: monthQ });
    if (!agg) return res.status(404).json({ message: "Property not found" });
    return res.json(mapAggregateToLegacyDetail(agg));
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load property details." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/statement", async (req: AuthRequest, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    await materializeDueRecurringExpenses(req.userId!, propertyId);
    const includeExpected = req.query.includeExpected !== "false";
    const month = typeof req.query.month === "string" ? req.query.month : null;
    const stmt = await buildPropertyStatement(req.userId!, propertyId, {
      includeExpectedIncomeRows: includeExpected,
      calendarMonth: month
    });
    if (!stmt) return res.status(404).json({ message: "Property not found" });
    await applyDepositGrowthForCurrentPropertyLeases(req.userId!, propertyId);
    const currentInvoice = await getCurrentInvoiceForMonth(req.userId!, propertyId, month);
    const future = await buildFutureCharges(req.userId!, propertyId);
    const recurring = await buildRecurringChargesList(req.userId!, propertyId);

    const leases = await db.lease.findMany({
      where: { userId: req.userId!, propertyId },
      include: { tenant: true },
      orderBy: { createdAt: "desc" }
    });
    const deposits = leases
      .filter((l) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })))
      .map((l) => ({
        leaseId: l.id,
        tenantName: l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : null,
        amount: l.depositAmount,
        depositAnnualGrowthPercent: l.depositAnnualGrowthPercent ?? null,
        depositGrowthLastAppliedMonth: l.depositGrowthLastAppliedMonth ?? null
      }));

    return res.json({
      ...stmt,
      currentInvoice,
      deposits,
      futureCharges: future?.items ?? [],
      recurringCharges: recurring?.recurringCharges ?? []
    });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/:propertyId/statement failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load property statement." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/bond/preview-at-date", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const property = await assertPropertyOwner(req.userId!, propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    const raw = typeof req.query.dueDate === "string" ? req.query.dueDate.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return res.status(400).json({ message: "Query parameter dueDate must be YYYY-MM-DD" });
    }
    const expenseDay = expenseDateFromYmd(raw);
    const bondFinance = computePropertyBondFinance(property, expenseDay);
    return res.json({ dueDate: raw, bondFinance });
  } catch (err: any) {
    console.error("[ownedProperties] GET bond preview-at-date failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not preview bond payment for that date." });
  }
});

ownedPropertiesRoutes.post("/properties/:propertyId/bond/statement-row", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    const dueDate = typeof req.body?.dueDate === "string" ? req.body.dueDate.trim() : "";
    const result = await postBondStatementRow(req.userId!, propertyId, dueDate);
    if (!result.ok) {
      const payload: Record<string, unknown> = { message: result.message };
      if ("duplicateExpenseId" in result && result.duplicateExpenseId != null) {
        payload.duplicateExpenseId = result.duplicateExpenseId;
      }
      return res.status(result.status).json(payload);
    }
    return res.status(201).json({ expense: result.expense });
  } catch (err: any) {
    console.error("[ownedProperties] POST bond statement-row failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not add bond payment to statement." });
  }
});

ownedPropertiesRoutes.post("/properties/:propertyId/bond/backfill-statement-rows", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    const startDate = typeof req.body?.startDate === "string" ? req.body.startDate.trim() : "";
    const endDate = typeof req.body?.endDate === "string" ? req.body.endDate.trim() : "";
    const result = await backfillBondStatementRows(req.userId!, propertyId, startDate, endDate);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.status(201).json({
      createdCount: result.createdCount,
      createdIds: result.createdIds,
      skipped: result.skipped
    });
  } catch (err: any) {
    console.error("[ownedProperties] POST bond backfill-statement-rows failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not backfill bond payments." });
  }
});

ownedPropertiesRoutes.post("/properties/:propertyId/financials/backfill", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    const result = await runHistoricalBackfill(req.userId!, propertyId, req.body);
    if (!result.ok) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (err: any) {
    console.error("[ownedProperties] POST backfill failed", err?.stack ?? err);
    return res.status(500).json({ message: "Backfill failed." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/invoices/current", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    const month = typeof req.query.month === "string" ? req.query.month : null;
    const currentInvoice = await getCurrentInvoiceForMonth(req.userId!, propertyId, month);
    return res.json({ currentInvoice: currentInvoice ? sanitizeInvoiceRow(currentInvoice) : null });
  } catch (err: any) {
    console.error("[ownedProperties] GET invoices/current failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load invoice." });
  }
});

ownedPropertiesRoutes.post("/properties/:propertyId/invoices/create-current", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    const leaseIdRaw = req.body?.leaseId;
    const leaseId = leaseIdRaw != null && leaseIdRaw !== "" ? Number(leaseIdRaw) : NaN;
    const result = Number.isFinite(leaseId)
      ? await createDraftInvoiceForLease(req.userId!, propertyId, leaseId)
      : await createDraftInvoiceFromCurrentLease(req.userId!, propertyId);
    if (!result.ok) {
      if ("invoiceId" in result && result.invoiceId != null) return res.status(409).json(result);
      return res.status(400).json(result);
    }
    return res.status(201).json(result.invoice);
  } catch (err: any) {
    console.error("[ownedProperties] POST invoices/create-current failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not create invoice." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/future-charges", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const fc = await buildFutureCharges(req.userId!, propertyId);
  return res.json(fc ?? { items: [] });
});

ownedPropertiesRoutes.get("/properties/:propertyId/recurring-charges", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const rc = await buildRecurringChargesList(req.userId!, propertyId);
  return res.json(rc ?? { recurringCharges: [] });
});

ownedPropertiesRoutes.post("/properties/:propertyId/recurring-charges", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) return res.status(404).json({ message: "Property not found" });

    const kind = req.body.kind ?? "expense";
    if (kind === "invoice_rule") {
      const tenantId = Number(req.body.tenantId);
      if (!tenantId) return res.status(400).json({ message: "tenantId is required for invoice_rule" });
      const tenant = await db.tenant.findFirst({ where: { id: tenantId, userId: req.userId!, propertyId } });
      if (!tenant) return res.status(400).json({ message: "Invalid tenant for property" });
      const nextRun = req.body.nextRunDate ? new Date(req.body.nextRunDate) : new Date();
      const created = await db.recurringInvoiceRule.create({
        data: {
          userId: req.userId!,
          propertyId,
          tenantId,
          leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
          frequency: req.body.frequency ?? "MONTHLY",
          dayOfMonth: req.body.dayOfMonth != null ? Number(req.body.dayOfMonth) : 1,
          nextRunDate: nextRun,
          invoiceDescription: req.body.description ?? "Monthly charge",
          rentAmount: asNumber(req.body.amount),
          enabled: req.body.enabled !== false
        }
      });
      return res.status(201).json(created);
    }

    const startRaw = req.body.recurringStartDate ?? req.body.expenseDate;
    const startYmd =
      typeof startRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
        ? startRaw
        : new Date(startRaw ?? Date.now()).toISOString().slice(0, 10);
    const parsedAnchor = parseRecurringExpenseMonthAnchor(req.body ?? {});
    if (!parsedAnchor.ok) return res.status(400).json({ message: parsedAnchor.message });
    const { anchor, recurringDayOfMonth } = parsedAnchor;
    const openEnded = Boolean(req.body.recurringOpenEnded ?? true);
    const endRaw = req.body.recurringEndDate;
    const endYmd =
      openEnded || endRaw == null || endRaw === ""
        ? null
        : typeof endRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
          ? endRaw
          : new Date(endRaw).toISOString().slice(0, 10);
    const firstDue = firstDueYmdOnOrAfter(startYmd, anchor, recurringDayOfMonth);
    const created = await db.propertyExpense.create({
      data: {
        userId: req.userId!,
        propertyId,
        category: req.body.category ?? "OTHER",
        description: req.body.description ?? "Recurring expense",
        amount: asNumber(req.body.amount),
        expenseDate: expenseDateFromYmd(firstDue),
        isRecurring: true,
        recurringFrequency: req.body.recurringFrequency ?? "MONTHLY",
        recurringStartDate: new Date(startYmd + "T12:00:00.000Z"),
        recurringEndDate: endYmd ? new Date(endYmd + "T12:00:00.000Z") : null,
        recurringOpenEnded: openEnded,
        recurringMonthAnchor: anchor,
        recurringDayOfMonth: anchor === "DAY_OF_MONTH" ? recurringDayOfMonth : null,
        source: "MANUAL_FINANCIAL_ENTRY",
        status: "ACTIVE"
      }
    });
    await materializeDueRecurringExpenses(req.userId!, propertyId);
    return res.status(201).json(created);
  } catch (err: any) {
    console.error("[ownedProperties] POST recurring-charges failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not create recurring charge." });
  }
});

ownedPropertiesRoutes.put("/recurring-charges/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const rule = await db.recurringInvoiceRule.findFirst({ where: { id, userId: req.userId! } });
    if (!rule) return res.status(404).json({ message: "Recurring charge not found" });
    const patch: any = {};
    if (req.body.rentAmount != null) patch.rentAmount = asNumber(req.body.rentAmount);
    if (req.body.invoiceDescription != null) patch.invoiceDescription = req.body.invoiceDescription;
    if (req.body.dayOfMonth != null) patch.dayOfMonth = Number(req.body.dayOfMonth);
    if (req.body.enabled !== undefined) patch.enabled = Boolean(req.body.enabled);
    if (req.body.nextRunDate) patch.nextRunDate = new Date(req.body.nextRunDate);
    const updated = await db.recurringInvoiceRule.update({ where: { id }, data: patch });
    return res.json(updated);
  } catch (err: any) {
    console.error("[ownedProperties] PUT recurring-charges/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not update recurring charge." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/reports", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json({
    propertyId,
    reports: [
      { id: "property-statement-pdf", title: "Property statement PDF", description: "Generate from Financials tab actions.", tab: "financials" },
      { id: "income-expense", title: "Income & expense report", description: "Uses the same ledger as your workspace statement.", tab: "financials" },
      { id: "tenant-statement", title: "Tenant statement", description: "Open Tenants tab and use invoices / ledger.", tab: "tenants" },
      { id: "invoice-pdfs", title: "Invoice PDF list", description: "Create invoices under Financials then generate PDF.", tab: "financials" },
      { id: "lease-summary", title: "Lease summary", description: "Current and historical leases on this property.", tab: "leases" },
      { id: "investor-performance", title: "Investor performance", description: "Portfolio dashboard filtered to this property.", href: `/owned-properties/dashboard?propertyId=${propertyId}` }
    ]
  });
});

ownedPropertiesRoutes.post("/properties/:propertyId/tenants/link", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const tenantId = Number(req.body.tenantId);
    if (!tenantId) return res.status(400).json({ message: "tenantId is required." });
    const property = await assertPropertyOwner(req.userId!, propertyId);
    if (!property) return res.status(404).json({ message: "Property not found." });
    const tenant = await db.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const currentLease = await db.lease.findFirst({ where: { userId: req.userId!, tenantId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } } });
    if (currentLease && currentLease.propertyId !== propertyId) {
      return res.status(400).json({ message: "Tenant has an active lease. Cancel or terminate the current lease before moving the tenant." });
    }

    const updated = await db.tenant.update({ where: { id: tenantId }, data: { propertyId, status: "ACTIVE" } });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] POST tenants/link failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to link tenant to property." });
  }
});

ownedPropertiesRoutes.put("/properties/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await assertPropertyOwner(req.userId!, id);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  try {
    const updated = await db.property.update({
      where: { id },
      data: buildPropertyUpdateData(req.body as Record<string, unknown>)
    });

    // When the bond profile is edited, ensure there is a BOND_PAYMENT statement row for the current month.
    // This keeps statements and dashboard metrics consistent (bond is treated as debt service expense everywhere).
    const touchedBond =
      req.body?.monthlyBondPayment !== undefined ||
      req.body?.outstandingBondBalance !== undefined ||
      req.body?.bondAnnualInterestRatePercent !== undefined ||
      req.body?.bondTermYears !== undefined ||
      req.body?.bondStartDate !== undefined ||
      req.body?.bondRemainingTermMonths !== undefined;
    if (touchedBond) {
      const now = new Date();
      const preferredDom =
        updated.bondStartDate instanceof Date && !Number.isNaN(updated.bondStartDate.getTime())
          ? updated.bondStartDate.getUTCDate()
          : 1;
      const dueYmd = dueYmdForCalendarMonth(now.getUTCFullYear(), now.getUTCMonth() + 1, preferredDom);
      const existingBondRow = await findActiveBondExpenseInDueMonth(req.userId!, id, dueYmd);
      if (!existingBondRow) {
        await postBondStatementRow(req.userId!, id, dueYmd);
      }
    }

    return res.json(updated);
  } catch (err: any) {
    console.error("[ownedProperties] PUT /properties/:id failed", err?.stack ?? err);
    return res.status(400).json({ message: err?.message ?? "Failed to update property." });
  }
});

ownedPropertiesRoutes.delete("/properties/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await assertPropertyOwner(req.userId!, id);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  await db.property.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.get("/properties/:propertyId/tenants", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const tenants = await db.tenant.findMany({
    where: {
      userId: req.userId!,
      OR: [
        { propertyId },
        { leases: { some: { propertyId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } } } }
      ]
    },
    include: {
      leases: {
        where: { propertyId },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const enriched = tenants.map((t) => {
    const lease = t.leases.find((l) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))) ?? null;
    const displayStatus = lease ? leaseDisplayStatus({ status: lease.status, fixedTermEndDate: lease.fixedTermEndDate }) : "VACANT";
    return {
      ...t,
      currentLease: lease
        ? {
            id: lease.id,
            status: lease.status,
            displayStatus,
            leaseType: lease.leaseType,
            startDate: lease.startDate,
            fixedTermEndDate: lease.fixedTermEndDate,
            monthlyRent: lease.monthlyRent,
            depositAmount: lease.depositAmount,
            rentDueDay: lease.rentDueDay
          }
        : null
    };
  });

  return res.json({ tenants: enriched });
});

ownedPropertiesRoutes.post("/properties/:propertyId/tenants", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  if (!req.body?.firstName || !req.body?.lastName) return res.status(400).json({ message: "firstName and lastName are required" });
  const tenant = await db.tenant.create({
    data: {
      userId: req.userId!,
      propertyId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email ?? null,
      phone: req.body.phone ?? null,
      idNumber: req.body.idNumber ?? null,
      emergencyContactName: req.body.emergencyContactName ?? null,
      emergencyContactPhone: req.body.emergencyContactPhone ?? null,
      status: req.body.status ?? "ACTIVE"
    }
  });
  return res.status(201).json(tenant);
});

ownedPropertiesRoutes.patch("/properties/:propertyId/tenants/:tenantId/link", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const tenantId = Number(req.params.tenantId);
    const property = await assertPropertyOwner(req.userId!, propertyId);
    if (!property) return res.status(404).json({ message: "Property not found." });
    const tenant = await db.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const currentLease = await db.lease.findFirst({ where: { userId: req.userId!, tenantId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } } });
    if (currentLease && currentLease.propertyId !== propertyId) {
      return res.status(400).json({ message: "Tenant has an active lease. Cancel or terminate the current lease before moving the tenant." });
    }

    const updated = await db.tenant.update({ where: { id: tenantId }, data: { propertyId, status: "ACTIVE" } });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] PATCH /properties/:propertyId/tenants/:tenantId/link failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to link tenant to property." });
  }
});

ownedPropertiesRoutes.patch("/properties/:propertyId/tenants/:tenantId/unlink", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const tenantId = Number(req.params.tenantId);
    const property = await assertPropertyOwner(req.userId!, propertyId);
    if (!property) return res.status(404).json({ message: "Property not found." });
    const tenant = await db.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const currentLease = await db.lease.findFirst({
      where: { userId: req.userId!, tenantId, propertyId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
    });
    if (currentLease) return res.status(400).json({ message: "Cancel the current lease before unlinking this tenant." });

    const updated = await db.tenant.update({ where: { id: tenantId }, data: { propertyId: null } });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] PATCH /properties/:propertyId/tenants/:tenantId/unlink failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to unlink tenant." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/leases", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const leases = await db.lease.findMany({
    where: { userId: req.userId!, propertyId },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  });
  const withDisplay = leases.map((l) => ({
    ...l,
    displayStatus: leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })
  }));
  const currentLeases = withDisplay.filter((l) => isCurrentLeaseStatus(l.displayStatus));
  const currentLease = currentLeases[0] ?? null;
  const historicalLeases = withDisplay.filter((l) => !isCurrentLeaseStatus(l.displayStatus));
  return res.json({
    currentLeases,
    currentLease,
    historicalLeases,
    leases: withDisplay
  });
});

ownedPropertiesRoutes.get("/properties/:propertyId/current-lease", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const leases = await db.lease.findMany({
    where: { userId: req.userId!, propertyId },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  });
  const withDisplay = leases.map((l) => ({
    ...l,
    displayStatus: leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })
  }));
  const currentLeases = withDisplay.filter((l) => isCurrentLeaseStatus(l.displayStatus));
  const current = currentLeases[0] ?? null;
  return res.json({ currentLeases, currentLease: current });
});

ownedPropertiesRoutes.post("/properties/:propertyId/leases", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const tenantId = Number(req.body.tenantId);
  if (!tenantId) return res.status(400).json({ message: "tenantId is required" });
  if (!req.body?.startDate) return res.status(400).json({ message: "startDate is required" });
  if (!isValidDayOfMonth(req.body.rentDueDay ?? 1)) return res.status(400).json({ message: "rentDueDay must be between 1 and 31" });

  const leaseType = req.body.leaseType ?? "FIXED_TERM";
  if (!["FIXED_TERM", "MONTH_TO_MONTH"].includes(leaseType)) return res.status(400).json({ message: "Invalid leaseType" });

  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, userId: req.userId!, OR: [{ propertyId }, { propertyId: null }] }
  });
  if (!tenant) return res.status(400).json({ message: "Invalid tenant" });

  const existingTenantCurrentLease = await db.lease.findFirst({
    where: { userId: req.userId!, tenantId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] }, cancellationDate: null }
  });
  if (existingTenantCurrentLease) {
    return res.status(409).json({
      message: "This tenant already has a current lease. Cancel the existing lease before creating a new one.",
      blocking: {
        tenantLeaseId: existingTenantCurrentLease?.id ?? null,
        tenantLeasePropertyId: existingTenantCurrentLease?.propertyId ?? null,
        tenantLeaseStatus: existingTenantCurrentLease?.status ?? null
      }
    });
  }

  const fixedTermEndDate = req.body.fixedTermEndDate
    ? new Date(req.body.fixedTermEndDate)
    : req.body.endDate
      ? new Date(req.body.endDate)
      : null;
  const startDate = new Date(req.body.startDate);
  if (Number.isNaN(startDate.getTime())) return res.status(400).json({ message: "Invalid startDate" });
  if (fixedTermEndDate && Number.isNaN(fixedTermEndDate.getTime())) return res.status(400).json({ message: "Invalid fixedTermEndDate" });
  if (fixedTermEndDate && fixedTermEndDate <= startDate) return res.status(400).json({ message: "fixedTermEndDate must be after startDate" });

  const monthlyRent = asNumber(req.body.monthlyRent);
  const depositAmount = asNumber(req.body.depositAmount);
  if (monthlyRent < 0) return res.status(400).json({ message: "monthlyRent must be non-negative" });
  if (depositAmount < 0) return res.status(400).json({ message: "depositAmount must be non-negative" });

  const result = await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data: { propertyId, status: "ACTIVE" } });
    const lease = await tx.lease.create({
      data: {
        userId: req.userId!,
        propertyId,
        tenantId,
        startDate,
        fixedTermEndDate,
        leaseType,
        monthlyRent,
        depositAmount,
        rentDueDay: req.body.rentDueDay != null ? Number(req.body.rentDueDay) : 1,
        escalationPercent: req.body.escalationPercent != null ? asNumber(req.body.escalationPercent) : null,
        escalationDate: req.body.escalationDate ? new Date(req.body.escalationDate) : null,
        status: leaseType === "MONTH_TO_MONTH" ? "MONTH_TO_MONTH" : "ACTIVE",
        leaseDocumentId: req.body.leaseDocumentId != null ? Number(req.body.leaseDocumentId) : null,
        notes: req.body.notes ?? null
      }
    });

    const createExpectedRentRule = req.body.createExpectedRentRule !== false;
    if (createExpectedRentRule) {
      await tx.recurringIncomeRule.create({
        data: {
          userId: req.userId!,
          propertyId,
          tenantId,
          leaseId: lease.id,
          category: "RENT",
          amount: monthlyRent,
          frequency: "MONTHLY",
          dayOfMonth: lease.rentDueDay,
          startDate: lease.startDate,
          endDate: lease.leaseType === "FIXED_TERM" ? lease.fixedTermEndDate : null,
          status: "ACTIVE",
          autoCreateExpectedEntries: false
        }
      });
    }
    return lease;
  });

  return res.status(201).json(result);
});

ownedPropertiesRoutes.put("/leases/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const lease = await db.lease.findFirst({
    where: { id, userId: req.userId! },
    include: { invoices: true, incomeEntries: true }
  });
  if (!lease) return res.status(404).json({ message: "Lease not found" });
  if (["CANCELLED", "TERMINATED"].includes(lease.status as any)) return res.status(400).json({ message: "Cannot edit a cancelled/terminated lease." });
  const isArchived = lease.status === ("ARCHIVED" as any);
  const hasLinks = (lease.invoices?.length ?? 0) > 0 || (lease.incomeEntries?.length ?? 0) > 0;
  if (isArchived && hasLinks) {
    return res.status(400).json({ message: "Cannot edit an archived lease that has linked invoices/income entries." });
  }

  const patch: any = {};
  if (req.body.monthlyRent != null) patch.monthlyRent = asNumber(req.body.monthlyRent);
  if (req.body.depositAmount != null) {
    patch.depositAmount = asNumber(req.body.depositAmount);
    patch.depositGrowthLastAppliedMonth = ymNow();
  }
  if (req.body.depositAnnualGrowthPercent !== undefined) {
    if (req.body.depositAnnualGrowthPercent === null || req.body.depositAnnualGrowthPercent === "") {
      patch.depositAnnualGrowthPercent = null;
      patch.depositGrowthLastAppliedMonth = null;
    } else {
      const p = asNumber(req.body.depositAnnualGrowthPercent);
      if (Number.isNaN(p) || p < 0 || p > 100) return res.status(400).json({ message: "depositAnnualGrowthPercent must be between 0 and 100" });
      if (p === 0) {
        patch.depositAnnualGrowthPercent = null;
        patch.depositGrowthLastAppliedMonth = null;
      } else {
        patch.depositAnnualGrowthPercent = p;
        patch.depositGrowthLastAppliedMonth = ymNow();
      }
    }
  }
  if (req.body.rentDueDay != null) {
    if (!isValidDayOfMonth(req.body.rentDueDay)) return res.status(400).json({ message: "rentDueDay must be between 1 and 31" });
    patch.rentDueDay = Number(req.body.rentDueDay);
  }
  if (req.body.startDate) patch.startDate = new Date(req.body.startDate);
  if (req.body.fixedTermEndDate !== undefined) patch.fixedTermEndDate = req.body.fixedTermEndDate ? new Date(req.body.fixedTermEndDate) : null;
  if (req.body.leaseType) patch.leaseType = req.body.leaseType;
  if (req.body.notes !== undefined) patch.notes = req.body.notes ?? null;

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.lease.update({ where: { id }, data: patch });
    if (patch.monthlyRent != null) {
      await tx.recurringIncomeRule.updateMany({
        where: { userId: req.userId!, leaseId: id },
        data: { amount: patch.monthlyRent }
      });
    }
    if (patch.rentDueDay != null) {
      await tx.recurringIncomeRule.updateMany({
        where: { userId: req.userId!, leaseId: id },
        data: { dayOfMonth: patch.rentDueDay }
      });
    }
    if (patch.startDate != null || patch.fixedTermEndDate !== undefined) {
      await tx.recurringIncomeRule.updateMany({
        where: { userId: req.userId!, leaseId: id },
        data: {
          startDate: patch.startDate ?? lease.startDate,
          endDate: patch.fixedTermEndDate !== undefined ? patch.fixedTermEndDate : lease.fixedTermEndDate
        }
      });
    }
    return next;
  });

  return res.json(updated);
});

ownedPropertiesRoutes.delete("/leases/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const lease = await db.lease.findFirst({
    where: { id, userId: req.userId! },
    include: { invoices: true, incomeEntries: true }
  });
  if (!lease) return res.status(404).json({ message: "Lease not found" });
  const isDraft = lease.status === "DRAFT";
  const hasLinks = (lease.invoices?.length ?? 0) > 0 || (lease.incomeEntries?.length ?? 0) > 0;

  if (isDraft && !hasLinks) {
    await db.$transaction(async (tx) => {
      await tx.recurringIncomeRule.deleteMany({ where: { userId: req.userId!, leaseId: id } });
      await tx.lease.delete({ where: { id } });
    });
    return res.json({ message: "Deleted draft lease" });
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.recurringIncomeRule.updateMany({ where: { userId: req.userId!, leaseId: id }, data: { status: "CANCELLED" } });
    return await tx.lease.update({ where: { id }, data: { status: "ARCHIVED" } });
  });
  return res.json({ message: "Archived lease", lease: updated });
});

/**
 * @deprecated Prefer Storage-backed flows for Supabase; see `documentsSupabase.ts` on the SPA.
 * Strip internal storage fields before returning a document to a client.
 * `filePath` (server-side absolute path) and `mimeType` (sometimes useful but
 * not needed by the UI) stay server-side; the client only sees a download URL
 * plus user-friendly metadata.
 */
function presentDocument(doc: {
  id: number;
  propertyId: number;
  leaseId: number | null;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
}) {
  return {
    id: doc.id,
    propertyId: doc.propertyId,
    leaseId: doc.leaseId,
    documentType: doc.documentType,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    uploadedAt: doc.uploadedAt,
    downloadUrl: `/api/documents/${doc.id}/download`
  };
}

/** @deprecated Disk upload — use Supabase Storage for new cloud builds. */
ownedPropertiesRoutes.post(
  "/properties/:propertyId/documents/upload",
  (req, res, next) => documentUpload.upload.single("file")(req, res, next),
  async (req: AuthRequest, res) => {
    const propertyId = Number(req.params.propertyId);
    const existing = await assertPropertyOwner(req.userId!, propertyId);
    if (!existing) {
      await discardUploadedFile(req.file?.path);
      return res.status(404).json({ message: "Property not found" });
    }
    if (!req.file) {
      // multer either rejected the mimetype/extension or no file was sent.
      return res.status(400).json({ message: "No file uploaded or file type invalid" });
    }

    // Defence-in-depth: verify the saved file lives strictly under our upload
    // root. multer's diskStorage already guarantees this, but a future change
    // could weaken that — checking once costs nothing.
    const safeAbsolute = resolveWithinRootOrNull(propertyDocDir, path.basename(req.file.path));
    if (!safeAbsolute || safeAbsolute !== req.file.path) {
      await discardUploadedFile(req.file.path);
      return res.status(400).json({ message: "Upload rejected." });
    }

    // Magic-byte validation. We never trust the client-supplied Content-Type.
    const ext = safeExtensionFromOriginalName(req.file.originalname || "");
    const detected = await detectFileKind(req.file.path);
    if (!detectedKindMatchesExtension(detected, ext)) {
      await discardUploadedFile(req.file.path);
      return res.status(400).json({ message: "Uploaded file contents do not match the declared type." });
    }

    const displayFileName = sanitizeDisplayFilename(req.file.originalname, `document.${ext}`);
    const leaseId = req.body?.leaseId ? Number(req.body.leaseId) : null;
    const documentType = typeof req.body?.documentType === "string" ? req.body.documentType : "OTHER";

    const doc = await db.propertyDocument.create({
      data: {
        userId: req.userId!,
        propertyId,
        leaseId: Number.isInteger(leaseId) && (leaseId as number) > 0 ? leaseId : null,
        documentType,
        // Display label only; never re-used to build a filesystem path.
        fileName: displayFileName,
        // Server-controlled, basename-only — never the user's path.
        filePath: path.basename(req.file.path),
        mimeType: req.file.mimetype,
        fileSize: req.file.size
      }
    });
    return res.status(201).json(presentDocument(doc));
  }
);

/** @deprecated Lists Prisma disk-backed documents — Supabase lists from Postgres + Storage metadata. */
ownedPropertiesRoutes.get("/properties/:propertyId/documents", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const docs = await db.propertyDocument.findMany({
    where: { userId: req.userId!, propertyId },
    orderBy: { uploadedAt: "desc" }
  });
  return res.json(docs.map(presentDocument));
});

/**
 * Mint a short-lived signed download URL for a property document. Use this in
 * the frontend when the link must be hit directly by the browser (e.g. an
 * `<a href>` click) — the bearer-header flow still works for AJAX downloads.
 */
/** @deprecated Express signed URL for disk downloads — Supabase uses `createSignedUrl` on the bucket. */
ownedPropertiesRoutes.post("/documents/:id/sign-download", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid document id." });
  const doc = await db.propertyDocument.findFirst({ where: { id, userId: req.userId! } });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  const parts = signDownloadParams({ userId: req.userId!, kind: "document", resourceId: id });
  return res.json({
    url: buildSignedDownloadUrl(`/api/documents/${id}/download`, parts),
    expiresAt: parts.exp
  });
});

/** @deprecated Streams from local `uploads/property-documents`. */
ownedPropertiesRoutes.get(
  "/documents/:id/download",
  requireDownloadAuth("document", "id"),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const doc = await db.propertyDocument.findFirst({ where: { id, userId: req.userId! } });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // The DB row may contain either a basename (new behaviour) or, for legacy
    // rows, an absolute path written by older builds. Either way, we re-derive
    // the absolute location by resolving the basename strictly inside the
    // upload root — so a stale absolute path or any `..` segment is rejected.
    const basename = path.basename(doc.filePath);
    const absolutePath = resolveWithinRootOrNull(propertyDocDir, basename);
    if (!absolutePath) {
      console.warn("[ownedProperties] refusing to serve document outside upload root", { id });
      return res.status(404).json({ message: "Document not found" });
    }
    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ message: "Document file is missing." });
    }

    res.setHeader("Content-Type", typeof doc.mimeType === "string" && doc.mimeType ? doc.mimeType : "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      buildContentDisposition({ displayName: doc.fileName, fallback: "document" })
    );
    return res.sendFile(absolutePath);
  }
);

/** @deprecated Deletes Prisma row and local file under `uploads/property-documents`. */
ownedPropertiesRoutes.delete("/documents/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const doc = await db.propertyDocument.findFirst({ where: { id, userId: req.userId! } });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  await db.propertyDocument.delete({ where: { id } });

  const basename = path.basename(doc.filePath);
  const absolutePath = resolveWithinRootOrNull(propertyDocDir, basename);
  if (absolutePath) {
    try {
      await fs.unlink(absolutePath);
    } catch {
      // noop for missing/already-deleted files
    }
  }
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.get("/properties/:propertyId/financials", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });

  const includeArchived = req.query.includeArchived === "true";
  const expenseWhere: any = { userId: req.userId!, propertyId };
  const incomeWhere: any = { userId: req.userId!, propertyId };
  if (!includeArchived) {
    expenseWhere.status = { not: "ARCHIVED" };
    incomeWhere.status = { not: "ARCHIVED" };
  }

  const [summary, expenses, income, recurringRules] = await Promise.all([
    computeFinancialSummary(req.userId!, propertyId),
    db.propertyExpense.findMany({ where: expenseWhere, orderBy: { expenseDate: "desc" } }),
    db.propertyIncome.findMany({ where: incomeWhere, orderBy: { incomeDate: "desc" } }),
    db.recurringIncomeRule.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { createdAt: "desc" } })
  ]);

  return res.json({ propertyId, summary, expenses, income, recurringIncomeRules: recurringRules });
});

ownedPropertiesRoutes.get("/properties/:propertyId/financials/summary", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const summary = await computeFinancialSummary(req.userId!, propertyId);
  if (!summary) return res.status(404).json({ message: "Property not found" });

  const incomeByMonth = await db.propertyIncome.groupBy({
    by: ["incomeDate"],
    where: { userId: req.userId!, propertyId, status: "RECEIVED" },
    _sum: { amount: true }
  });
  const expenseByMonth = await db.propertyExpense.groupBy({
    by: ["expenseDate"],
    where: { userId: req.userId!, propertyId, status: "ACTIVE" },
    _sum: { amount: true }
  });
  const expenseBreakdown = await db.propertyExpense.groupBy({
    by: ["category"],
    where: { userId: req.userId!, propertyId, status: "ACTIVE" },
    _sum: { amount: true }
  });

  return res.json({
    ...summary,
    charts: {
      incomeVsExpensesOverTime: {
        income: incomeByMonth.map((i) => ({ date: i.incomeDate, amount: i._sum.amount ?? 0 })),
        expenses: expenseByMonth.map((e) => ({ date: e.expenseDate, amount: e._sum.amount ?? 0 }))
      },
      expenseBreakdownByCategory: expenseBreakdown.map((e) => ({ category: e.category, amount: e._sum.amount ?? 0 })),
      cashFlowByMonth: incomeByMonth.map((i) => {
        const month = `${i.incomeDate.getFullYear()}-${String(i.incomeDate.getMonth() + 1).padStart(2, "0")}`;
        const expenseForMonth = expenseByMonth
          .filter((e) => `${e.expenseDate.getFullYear()}-${String(e.expenseDate.getMonth() + 1).padStart(2, "0")}` === month)
          .reduce((acc, e) => acc + (e._sum.amount ?? 0), 0);
        return { month, cashFlow: (i._sum.amount ?? 0) - expenseForMonth };
      })
    }
  });
});

ownedPropertiesRoutes.post("/properties/:propertyId/expenses", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });

  const schedule = Boolean(req.body.recurringSchedule);
  const legacyRecurring = !schedule && Boolean(req.body.isRecurring);

  const parseYmd = (raw: unknown): string | null =>
    typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

  if (schedule) {
    const parsedAnchor = parseRecurringExpenseMonthAnchor(req.body ?? {});
    if (!parsedAnchor.ok) return res.status(400).json({ message: parsedAnchor.message });
    const { anchor, recurringDayOfMonth } = parsedAnchor;
    const startYmd = parseYmd(req.body.recurringStartDate);
    if (!startYmd) return res.status(400).json({ message: "recurringStartDate must be YYYY-MM-DD" });
    const openEnded = Boolean(req.body.recurringOpenEnded);
    const endYmd = openEnded ? null : parseYmd(req.body.recurringEndDate);
    if (!openEnded && !endYmd) {
      return res.status(400).json({ message: "recurringEndDate is required unless recurringOpenEnded is true" });
    }
    if (!openEnded && endYmd && endYmd < startYmd) {
      return res.status(400).json({ message: "recurringEndDate must be on or after recurringStartDate" });
    }
    const firstDue = firstDueYmdOnOrAfter(startYmd, anchor, recurringDayOfMonth);
    const created = await db.propertyExpense.create({
      data: {
        userId: req.userId!,
        propertyId,
        category: req.body.category,
        description: req.body.description,
        amount: asNumber(req.body.amount),
        expenseDate: expenseDateFromYmd(firstDue),
        isRecurring: true,
        recurringFrequency: "MONTHLY",
        recurringStartDate: new Date(startYmd + "T12:00:00.000Z"),
        recurringEndDate: endYmd ? new Date(endYmd + "T12:00:00.000Z") : null,
        recurringOpenEnded: openEnded,
        recurringMonthAnchor: anchor,
        recurringDayOfMonth: anchor === "DAY_OF_MONTH" ? recurringDayOfMonth : null,
        source: req.body.source ?? "MANUAL_FINANCIAL_ENTRY",
        status: req.body.status ?? "ACTIVE"
      }
    });
    await materializeDueRecurringExpenses(req.userId!, propertyId);
    return res.status(201).json(created);
  }

  const expenseDate = coerceExpenseDateFromBody(req.body.expenseDate);
  if (!expenseDate) {
    return res.status(400).json({ message: "Invalid expenseDate" });
  }

  const futureExpense = Boolean(req.body.futureExpense);
  if (futureExpense && (schedule || legacyRecurring)) {
    return res.status(400).json({ message: "futureExpense applies only to one-off expenses." });
  }
  if (futureExpense) {
    const ymd = expenseDate.toISOString().slice(0, 10);
    const todayUtcStr = new Date().toISOString().slice(0, 10);
    if (ymd <= todayUtcStr) {
      return res.status(400).json({
        message: "Future expenses must use a payment date strictly after today (UTC calendar date)."
      });
    }
  }

  if (legacyRecurring) {
    const startYmd = expenseDate.toISOString().slice(0, 10);
    const firstDue = firstDueYmdOnOrAfter(startYmd, "FIRST_OF_MONTH");
    const created = await db.propertyExpense.create({
      data: {
        userId: req.userId!,
        propertyId,
        category: req.body.category,
        description: req.body.description,
        amount: asNumber(req.body.amount),
        expenseDate: expenseDateFromYmd(firstDue),
        isRecurring: true,
        recurringFrequency: "MONTHLY",
        recurringStartDate: new Date(startYmd + "T12:00:00.000Z"),
        recurringEndDate: null,
        recurringOpenEnded: true,
        recurringMonthAnchor: "FIRST_OF_MONTH",
        source: req.body.source ?? "MANUAL_FINANCIAL_ENTRY",
        status: req.body.status ?? "ACTIVE"
      }
    });
    await materializeDueRecurringExpenses(req.userId!, propertyId);
    return res.status(201).json(created);
  }

  const created = await db.propertyExpense.create({
      data: {
        userId: req.userId!,
        propertyId,
        category: req.body.category,
        description: req.body.description,
        amount: asNumber(req.body.amount),
        expenseDate,
        isRecurring: false,
        recurringFrequency: null,
        bondInterestAmount:
          req.body.bondInterestAmount != null && req.body.bondInterestAmount !== ""
            ? asNumber(req.body.bondInterestAmount)
            : null,
        bondPrincipalAmount:
          req.body.bondPrincipalAmount != null && req.body.bondPrincipalAmount !== ""
            ? asNumber(req.body.bondPrincipalAmount)
            : null,
        source: req.body.source ?? "MANUAL_FINANCIAL_ENTRY",
        status: req.body.status ?? "ACTIVE"
      }
    });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.post("/properties/:propertyId/income", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const created = await db.propertyIncome.create({
    data: {
      userId: req.userId!,
      propertyId,
      tenantId: req.body.tenantId != null ? Number(req.body.tenantId) : null,
      leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
      category: req.body.category,
      description: req.body.description,
      amount: asNumber(req.body.amount),
      incomeDate: new Date(req.body.incomeDate),
      source: req.body.source ?? "MANUAL_FINANCIAL_ENTRY",
      status: req.body.status ?? "RECEIVED"
    }
  });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.get("/properties/:propertyId/expenses", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.propertyExpense.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { expenseDate: "desc" } }));
});

ownedPropertiesRoutes.get("/properties/:propertyId/income", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.propertyIncome.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { incomeDate: "desc" } }));
});

ownedPropertiesRoutes.patch("/expenses/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyExpense.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Expense not found" });
  const data: Record<string, unknown> = {};
  if (req.body.category != null) data.category = req.body.category;
  if (req.body.description != null) data.description = String(req.body.description);
  if (req.body.amount != null) data.amount = asNumber(req.body.amount);
  if (req.body.expenseDate != null) {
    const coerced = coerceExpenseDateFromBody(req.body.expenseDate);
    if (!coerced) return res.status(400).json({ message: "Invalid expenseDate" });
    data.expenseDate = coerced;
  }
  if (req.body.isRecurring != null) data.isRecurring = Boolean(req.body.isRecurring);
  if (req.body.recurringFrequency !== undefined) data.recurringFrequency = req.body.recurringFrequency ?? null;
  if (existing.isRecurring && existing.recurringScheduleParentId == null) {
    if (req.body.recurringStartDate !== undefined) {
      data.recurringStartDate =
        req.body.recurringStartDate == null || req.body.recurringStartDate === ""
          ? null
          : new Date(String(req.body.recurringStartDate));
    }
    if (req.body.recurringEndDate !== undefined) {
      data.recurringEndDate =
        req.body.recurringEndDate == null || req.body.recurringEndDate === ""
          ? null
          : new Date(String(req.body.recurringEndDate));
    }
    if (req.body.recurringOpenEnded !== undefined) data.recurringOpenEnded = Boolean(req.body.recurringOpenEnded);
    if (req.body.recurringMonthAnchor !== undefined) {
      const parsed = parseRecurringExpenseMonthAnchor({
        recurringMonthAnchor: req.body.recurringMonthAnchor,
        recurringDayOfMonth: req.body.recurringDayOfMonth ?? existing.recurringDayOfMonth
      });
      if (!parsed.ok) return res.status(400).json({ message: parsed.message });
      data.recurringMonthAnchor = parsed.anchor;
      data.recurringDayOfMonth = parsed.anchor === "DAY_OF_MONTH" ? parsed.recurringDayOfMonth : null;
    }
    if (req.body.recurringDayOfMonth !== undefined && req.body.recurringMonthAnchor === undefined) {
      const anchor = (existing.recurringMonthAnchor ?? "FIRST_OF_MONTH") as RecurringExpenseMonthAnchor;
      if (anchor !== "DAY_OF_MONTH") {
        return res.status(400).json({ message: "recurringDayOfMonth applies only when recurringMonthAnchor is DAY_OF_MONTH" });
      }
      if (!isValidDayOfMonth(req.body.recurringDayOfMonth)) {
        return res.status(400).json({ message: "recurringDayOfMonth must be an integer 1–31" });
      }
      data.recurringDayOfMonth = Number(req.body.recurringDayOfMonth);
    }
  }
  if (req.body.bondInterestAmount !== undefined) {
    data.bondInterestAmount =
      req.body.bondInterestAmount === null || req.body.bondInterestAmount === ""
        ? null
        : asNumber(req.body.bondInterestAmount);
  }
  if (req.body.bondPrincipalAmount !== undefined) {
    data.bondPrincipalAmount =
      req.body.bondPrincipalAmount === null || req.body.bondPrincipalAmount === ""
        ? null
        : asNumber(req.body.bondPrincipalAmount);
  }
  if (req.body.status !== undefined) {
    const s = req.body.status;
    if (s !== "ACTIVE" && s !== "ARCHIVED" && s !== "CANCELLED") {
      return res.status(400).json({ message: "Invalid expense status" });
    }
    data.status = s;
  }

  const scheduleShapeKeys = ["recurringStartDate", "recurringEndDate", "recurringOpenEnded", "recurringMonthAnchor", "recurringDayOfMonth"];
  const touchesScheduleShape =
    existing.isRecurring &&
    existing.recurringScheduleParentId == null &&
    scheduleShapeKeys.some((k) => Object.prototype.hasOwnProperty.call(data, k));

  if (touchesScheduleShape) {
    const mergedStart =
      data.recurringStartDate !== undefined ? (data.recurringStartDate as Date | null) : existing.recurringStartDate;
    const mergedAnchorRaw =
      data.recurringMonthAnchor !== undefined ? data.recurringMonthAnchor : existing.recurringMonthAnchor;
    const anchor = (mergedAnchorRaw ?? "FIRST_OF_MONTH") as RecurringExpenseMonthAnchor;
    const mergedDom =
      data.recurringDayOfMonth !== undefined ? data.recurringDayOfMonth : existing.recurringDayOfMonth;
    const startSrc = mergedStart ?? existing.expenseDate;
    if (startSrc) {
      const startYmd =
        typeof startSrc === "string"
          ? String(startSrc).slice(0, 10)
          : new Date(startSrc as Date).toISOString().slice(0, 10);
      const dom =
        anchor === "DAY_OF_MONTH" && mergedDom != null && Number.isFinite(Number(mergedDom))
          ? Number(mergedDom)
          : null;
      data.expenseDate = expenseDateFromYmd(firstDueYmdOnOrAfter(startYmd, anchor, dom));
    }
  }

  const updated = await db.propertyExpense.update({ where: { id }, data: data as any });
  return res.json(updated);
});

ownedPropertiesRoutes.delete("/expenses/:id/hard", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
  const existing = await db.propertyExpense.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Expense not found" });
  /**
   * Posted recurring instances (`SYSTEM`) stay as ARCHIVED tombstones so materialisation doesn’t recreate them on the next statement load.
   * Removes them from the ledger view without resurrecting the month from the schedule template.
   */
  /** Any posted instance of a schedule must stay a tombstone so materialisation cannot recreate it (source may be legacy non-SYSTEM). */
  if (existing.recurringScheduleParentId != null) {
    await db.propertyExpense.update({ where: { id }, data: { status: "ARCHIVED" } });
    return res.json({ message: "Archived", archived: true });
  }
  await db.propertyExpense.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.delete("/income/:id/hard", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  await db.propertyIncome.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.delete("/expenses/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyExpense.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Expense not found" });
  const updated = await db.propertyExpense.update({ where: { id }, data: { status: "ARCHIVED" } });
  return res.json({ message: "Archived", expense: updated });
});

ownedPropertiesRoutes.delete("/income/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  const updated = await db.propertyIncome.update({ where: { id }, data: { status: "ARCHIVED" } });
  return res.json({ message: "Archived", income: updated });
});

ownedPropertiesRoutes.post("/income/:id/mark-received", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  if (existing.status !== "EXPECTED") return res.status(400).json({ message: "Only EXPECTED income can be marked as received." });

  const paymentDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();
  const updated = await db.propertyIncome.update({
    where: { id },
    data: {
      status: "RECEIVED",
      incomeDate: paymentDate
    }
  });
  return res.json({ income: updated });
});

ownedPropertiesRoutes.put("/income/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  if (existing.status === "ARCHIVED") return res.status(400).json({ message: "Cannot edit an archived income entry." });

  const patch: any = {};
  if (req.body.tenantId !== undefined) patch.tenantId = req.body.tenantId == null ? null : Number(req.body.tenantId);
  if (req.body.leaseId !== undefined) patch.leaseId = req.body.leaseId == null ? null : Number(req.body.leaseId);
  if (req.body.category) patch.category = req.body.category;
  if (req.body.description !== undefined) patch.description = req.body.description ?? "";
  if (req.body.amount !== undefined) patch.amount = asNumber(req.body.amount);
  if (req.body.incomeDate) patch.incomeDate = new Date(req.body.incomeDate);
  if (req.body.status) patch.status = req.body.status;

  const updated = await db.propertyIncome.update({ where: { id }, data: patch });
  return res.json({ income: updated });
});

/**
 * Strip the internal `pdfPath` (server-side storage location) from any invoice
 * row before it crosses the API boundary. Replaces it with a `hasPdf` boolean
 * + `downloadUrl` the frontend can use directly.
 */
function presentInvoice<T extends { id: number; pdfPath: string | null }>(inv: T): Omit<T, "pdfPath"> & { hasPdf: boolean; downloadUrl: string | null } {
  const { pdfPath, ...rest } = inv;
  return {
    ...(rest as Omit<T, "pdfPath">),
    hasPdf: Boolean(pdfPath),
    downloadUrl: pdfPath ? `/api/invoices/${inv.id}/download` : null
  };
}

ownedPropertiesRoutes.get("/properties/:propertyId/invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const rows = await db.invoice.findMany({
    where: { userId: req.userId!, propertyId },
    include: { lineItems: true, tenant: true },
    orderBy: { createdAt: "desc" }
  });
  return res.json(rows.map((r) => presentInvoice(r)));
});

ownedPropertiesRoutes.post("/properties/:propertyId/invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const property = await assertPropertyOwner(req.userId!, propertyId);
  if (!property) return res.status(404).json({ message: "Property not found" });
  const tenant = await db.tenant.findFirst({ where: { id: Number(req.body.tenantId), propertyId, userId: req.userId! } });
  if (!tenant) return res.status(400).json({ message: "Invalid tenant for property" });
  const invoiceNumber = req.body.invoiceNumber ?? `INV-${Date.now()}`;
  const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
  const subtotal = lineItems.reduce((acc: number, item: any) => acc + asNumber(item.total, asNumber(item.quantity) * asNumber(item.unitPrice)), 0);
  const total = req.body.total != null ? asNumber(req.body.total) : subtotal;

  const created = await db.invoice.create({
    data: {
      userId: req.userId!,
      propertyId,
      tenantId: Number(req.body.tenantId),
      leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
      invoiceNumber,
      invoiceDate: new Date(req.body.invoiceDate),
      dueDate: new Date(req.body.dueDate),
      status: req.body.status ?? "DRAFT",
      subtotal,
      total,
      notes: req.body.notes ?? null,
      lineItems: {
        create: lineItems.map((item: any) => ({
          description: item.description,
          quantity: asNumber(item.quantity, 1),
          unitPrice: asNumber(item.unitPrice),
          total: asNumber(item.total, asNumber(item.quantity) * asNumber(item.unitPrice))
        }))
      }
    },
    include: { lineItems: true }
  });
  return res.status(201).json(presentInvoice(created));
});

ownedPropertiesRoutes.delete("/invoices/:id/hard", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
  const existing = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Invoice not found" });
  if (existing.pdfPath) {
    const safeAbs = resolveStoredPdfAbsoluteOrNull(existing.pdfPath);
    if (safeAbs) {
      try {
        await fs.unlink(safeAbs);
      } catch {
        /* ignore missing file */
      }
    }
  }
  await db.invoice.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.get("/invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({
    where: { id, userId: req.userId! },
    include: { lineItems: true, property: true, tenant: true }
  });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  return res.json(presentInvoice(invoice));
});

ownedPropertiesRoutes.put("/invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Invoice not found" });
  const nextTotal = req.body.total != null ? asNumber(req.body.total) : existing.total;
  const updated = await db.invoice.update({
    where: { id },
    data: {
      invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : existing.invoiceDate,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : existing.dueDate,
      status: req.body.status ?? existing.status,
      notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
      total: nextTotal,
      subtotal: req.body.total != null ? nextTotal : existing.subtotal
    }
  });
  return res.json(presentInvoice(updated));
});

ownedPropertiesRoutes.post("/invoices/:id/generate-pdf", async (req: AuthRequest, res) => {
  try {
    await ensureReportsDirectory();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid invoice id." });

    const prior = await db.invoice.findFirst({
      where: { id, userId: req.userId! },
      select: { id: true, pdfPath: true }
    });
    if (!prior) return res.status(404).json({ message: "Invoice not found." });

    if (prior.pdfPath) {
      const safeAbs = resolveStoredPdfAbsoluteOrNull(prior.pdfPath);
      if (safeAbs) {
        try {
          await fs.unlink(safeAbs);
        } catch {
          /* stale path or missing file — regenerate cleanly */
        }
      }
    }

    const built = await buildInvoicePdfDefinition(id, req.userId!);
    if (!built.ok) return res.status(built.status).json({ message: built.message });

    // `built.fileName` is server-generated; resolve it strictly inside the
    // reports root so a future refactor cannot accidentally write elsewhere.
    const absolutePath = path.join(getReportsRoot(), built.fileName);
    if (!resolveStoredPdfAbsoluteOrNull(built.fileName)) {
      // This should never happen because the basename is server-generated; if
      // it does, abort instead of writing.
      return res.status(500).json({ message: "Failed to generate invoice PDF." });
    }
    await writePdfDefinitionToFile(built.definition, absolutePath);
    await db.invoice.update({ where: { id }, data: { pdfPath: built.fileName } });
    return res.json({
      message: "Invoice PDF generated",
      hasPdf: true,
      downloadUrl: `/api/invoices/${id}/download`
    });
  } catch (err: any) {
    console.error("[ownedProperties] POST invoices/:id/generate-pdf failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to generate invoice PDF." });
  }
});

/**
 * Mint a short-lived signed download URL for an invoice PDF. Same rationale
 * as the document/report variants — needed for direct browser navigation.
 */
ownedPropertiesRoutes.post("/invoices/:id/sign-download", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid invoice id." });
  const invoice = await db.invoice.findFirst({
    where: { id, userId: req.userId! },
    select: { id: true, pdfPath: true }
  });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  if (!invoice.pdfPath) return res.status(404).json({ message: "Invoice PDF not generated yet." });
  const parts = signDownloadParams({ userId: req.userId!, kind: "invoice", resourceId: id });
  return res.json({
    url: buildSignedDownloadUrl(`/api/invoices/${id}/download`, parts),
    expiresAt: parts.exp
  });
});

ownedPropertiesRoutes.get(
  "/invoices/:id/download",
  requireDownloadAuth("invoice", "id"),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const invoice = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (!invoice.pdfPath) return res.status(404).json({ message: "Invoice PDF not generated yet." });

      const absolutePath = resolveStoredPdfAbsoluteOrNull(invoice.pdfPath);
      if (!absolutePath) {
        console.warn("[ownedProperties] refusing to serve invoice PDF outside reports root", { id });
        return res.status(404).json({ message: "Invoice not found" });
      }
      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({ message: "PDF file is missing on disk. Generate the invoice PDF again." });
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        buildContentDisposition({ displayName: `invoice-${id}.pdf`, fallback: `invoice-${id}.pdf` })
      );
      return res.sendFile(absolutePath);
    } catch (err: any) {
      console.error("[ownedProperties] GET invoices/:id/download failed", err?.stack ?? err);
      return res.status(500).json({ message: "Failed to download invoice PDF." });
    }
});

ownedPropertiesRoutes.post("/invoices/:id/mark-paid", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const updated = await db.invoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
  return res.json(updated);
});

ownedPropertiesRoutes.post("/invoices/:id/send-email", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({
    where: { id, userId: req.userId! },
    include: { tenant: true }
  });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  if (!invoice.tenant.email) return res.status(400).json({ message: "Tenant email is missing." });
  const sent = await sendInvoiceEmail({
    to: invoice.tenant.email,
    subject: `Invoice ${invoice.invoiceNumber}`,
    text: `Invoice ${invoice.invoiceNumber} total ${invoice.total.toFixed(2)}`
  });
  if (!sent.ok) return res.status(400).json({ message: sent.message });
  await db.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  return res.json({ message: sent.message });
});

ownedPropertiesRoutes.get("/properties/:propertyId/recurring-invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.recurringInvoiceRule.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { createdAt: "desc" } }));
});

ownedPropertiesRoutes.post("/properties/:propertyId/recurring-invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const created = await db.recurringInvoiceRule.create({
    data: {
      userId: req.userId!,
      propertyId,
      tenantId: Number(req.body.tenantId),
      leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
      enabled: Boolean(req.body.enabled),
      frequency: "MONTHLY",
      dayOfMonth: req.body.dayOfMonth != null ? Number(req.body.dayOfMonth) : 1,
      nextRunDate: new Date(req.body.nextRunDate),
      invoiceDescription: req.body.invoiceDescription ?? "Monthly Rent",
      rentAmount: asNumber(req.body.rentAmount),
      includeUtilities: Boolean(req.body.includeUtilities),
      emailTenant: Boolean(req.body.emailTenant),
      tenantPermissionConfirmed: Boolean(req.body.tenantPermissionConfirmed)
    }
  });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.put("/recurring-invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringInvoiceRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring rule not found" });
  return res.json(await db.recurringInvoiceRule.update({ where: { id }, data: req.body }));
});

ownedPropertiesRoutes.delete("/recurring-invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringInvoiceRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring rule not found" });
  await db.recurringInvoiceRule.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.post("/recurring-invoices/run-due", async (req: AuthRequest, res) => {
  const now = new Date();
  const dueRules = await db.recurringInvoiceRule.findMany({
    where: { userId: req.userId!, enabled: true, nextRunDate: { lte: now } },
    include: { tenant: true }
  });
  const generated: any[] = [];

  for (const rule of dueRules) {
    const invoice = await db.invoice.create({
      data: {
        userId: req.userId!,
        propertyId: rule.propertyId,
        tenantId: rule.tenantId,
        leaseId: rule.leaseId,
        invoiceNumber: `AUTO-${Date.now()}-${rule.id}`,
        invoiceDate: now,
        dueDate: new Date(now.getFullYear(), now.getMonth(), Math.max(1, rule.dayOfMonth)),
        status: "DRAFT",
        subtotal: rule.rentAmount,
        total: rule.rentAmount,
        notes: "Generated by recurring invoice rule",
        lineItems: {
          create: [{ description: rule.invoiceDescription, quantity: 1, unitPrice: rule.rentAmount, total: rule.rentAmount }]
        }
      }
    });

    if (rule.enabled && rule.tenantPermissionConfirmed && rule.emailTenant) {
      if (!rule.tenant.email) continue;
      const result = await sendInvoiceEmail({
        to: rule.tenant.email,
        subject: `Invoice ${invoice.invoiceNumber}`,
        text: `Monthly invoice ${invoice.invoiceNumber}`
      });
      if (result.ok) {
        await db.invoice.update({ where: { id: invoice.id }, data: { status: "SENT", sentAt: new Date() } });
      }
    }

    const nextRun = new Date(rule.nextRunDate);
    nextRun.setMonth(nextRun.getMonth() + 1);
    await db.recurringInvoiceRule.update({ where: { id: rule.id }, data: { nextRunDate: nextRun } });
    generated.push(presentInvoice(invoice));
  }

  return res.json({
    message:
      "Recurring invoices run complete. Recurring invoices will only be emailed if you confirm permission and configure email sending.",
    generatedCount: generated.length,
    generated
  });
});

// --- Recurring expected rent income (draft/expected until marked received) ---
ownedPropertiesRoutes.get("/properties/:propertyId/recurring-income", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const rules = await db.recurringIncomeRule.findMany({
    where: { userId: req.userId!, propertyId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ rules });
});

ownedPropertiesRoutes.post("/recurring-income/:id/activate", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringIncomeRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring income rule not found" });
  const updated = await db.recurringIncomeRule.update({ where: { id }, data: { status: "ACTIVE" } });
  return res.json({ rule: updated });
});

ownedPropertiesRoutes.post("/recurring-income/:id/pause", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringIncomeRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring income rule not found" });
  const updated = await db.recurringIncomeRule.update({ where: { id }, data: { status: "PAUSED" } });
  return res.json({ rule: updated });
});

ownedPropertiesRoutes.post("/recurring-income/run-due", async (req: AuthRequest, res) => {
  const now = new Date();
  const rules = await db.recurringIncomeRule.findMany({
    where: { userId: req.userId!, status: "ACTIVE", autoCreateExpectedEntries: true }
  });
  const created: any[] = [];

  for (const rule of rules) {
    const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, rule.dayOfMonth)));
    if (dueDate > now) continue;
    if (rule.startDate > dueDate) continue;
    if (rule.endDate && dueDate > rule.endDate) continue;

    const exists = await db.propertyIncome.findFirst({
      where: {
        userId: req.userId!,
        propertyId: rule.propertyId,
        tenantId: rule.tenantId,
        leaseId: rule.leaseId,
        category: rule.category,
        source: "LEASE_EXPECTED",
        incomeDate: dueDate
      }
    });
    if (exists) continue;

    const inc = await db.propertyIncome.create({
      data: {
        userId: req.userId!,
        propertyId: rule.propertyId,
        tenantId: rule.tenantId,
        leaseId: rule.leaseId,
        category: rule.category,
        description: "Expected rent",
        amount: rule.amount,
        incomeDate: dueDate,
        source: "LEASE_EXPECTED",
        status: "EXPECTED"
      }
    });
    created.push(inc);
  }

  return res.json({ message: "Recurring expected income run complete.", createdCount: created.length, created });
});

ownedPropertiesRoutes.post("/recurring-expenses/run-due", async (req: AuthRequest, res) => {
  const templates = await db.propertyExpense.groupBy({
    by: ["propertyId"],
    where: {
      userId: req.userId!,
      status: "ACTIVE",
      isRecurring: true,
      recurringScheduleParentId: null
    }
  });
  let created = 0;
  for (const row of templates) {
    created += (await materializeDueRecurringExpenses(req.userId!, row.propertyId)).created;
  }
  return res.json({ message: "Recurring expense materialization complete.", createdCount: created });
});

ownedPropertiesRoutes.post("/leases/:id/cancel", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const lease = await db.lease.findFirst({ where: { id, userId: req.userId! } });
    if (!lease) return res.status(404).json({ message: "Lease not found" });
    if (["CANCELLED", "TERMINATED", "ARCHIVED"].includes(lease.status as any)) {
      return res.status(400).json({ message: "Lease already cancelled/terminated" });
    }

    const cancellationDate = req.body.cancellationDate ? new Date(req.body.cancellationDate) : null;
    if (!cancellationDate || Number.isNaN(cancellationDate.getTime())) {
      return res.status(400).json({ message: "cancellationDate is required (YYYY-MM-DD)" });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.recurringIncomeRule.updateMany({ where: { userId: req.userId!, leaseId: id }, data: { status: "CANCELLED" } });
      // Cancel any FUTURE expected income that was generated for this lease
      await tx.propertyIncome.updateMany({
        where: { userId: req.userId!, leaseId: id, status: "EXPECTED", incomeDate: { gt: cancellationDate } },
        data: { status: "CANCELLED" }
      });
      return await tx.lease.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancellationDate,
          cancellationReason: req.body.cancellationReason ?? null,
          cancelledBy: req.body.cancelledBy ?? null
        }
      });
    });

    const otherCurrent = await db.lease.findFirst({
      where: { userId: req.userId!, tenantId: updated.tenantId, id: { not: updated.id }, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
    });
    if (!otherCurrent) {
      await db.tenant.update({ where: { id: updated.tenantId }, data: { status: "PAST", propertyId: null } });
    }

    return res.json({ lease: updated });
  } catch (err: any) {
    console.error("[ownedProperties] POST /leases/:id/cancel failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to cancel lease." });
  }
});

