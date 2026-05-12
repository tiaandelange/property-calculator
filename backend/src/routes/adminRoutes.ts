import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { db } from "../config/db.js";
import { getPortfolioProjectionGrowthRates, updatePortfolioProjectionGrowthRates } from "../services/portfolioProjectionDefaults.js";
import { exportPortfolioBackup, resetPortfolioData } from "../services/portfolioResetService.js";
import { assertPortfolioResetAllowed } from "../utils/portfolioResetGuards.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const adminRoutes = Router();

adminRoutes.get("/status", requireAuth, requireAdmin, (_req, res) => {
  return res.json({ message: "Admin access granted" });
});

adminRoutes.get("/portfolio-projection-metrics", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const metrics = await getPortfolioProjectionGrowthRates(db);
    return res.json({
      metrics,
      description:
        "These rates project future rental income and total expenses when calculating portfolio IRR. Property value growth still uses each property’s expected annual appreciation %."
    });
  } catch (err: any) {
    console.error("[admin] GET /portfolio-projection-metrics failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load projection metrics." });
  }
});

adminRoutes.patch("/portfolio-projection-metrics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};
    const rental =
      typeof body.rentalIncomeGrowthPercentAnnual === "number" ? body.rentalIncomeGrowthPercentAnnual : undefined;
    const expenses =
      typeof body.totalExpensesGrowthPercentAnnual === "number" ? body.totalExpensesGrowthPercentAnnual : undefined;
    const updated = await updatePortfolioProjectionGrowthRates(db, {
      rentalIncomeGrowthPercentAnnual: rental,
      totalExpensesGrowthPercentAnnual: expenses
    });
    return res.json({ metrics: updated });
  } catch (err: any) {
    console.error("[admin] PATCH /portfolio-projection-metrics failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to update projection metrics." });
  }
});

adminRoutes.post("/dev/reset-portfolio-data", requireAuth, requireAdmin, async (req, res) => {
  const confirm = typeof req.body?.confirm === "string" ? req.body.confirm : "";
  try {
    assertPortfolioResetAllowed({ nodeEnv: process.env.NODE_ENV, confirm });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Forbidden";
    if (process.env.NODE_ENV === "production") return res.status(403).json({ message: msg });
    return res.status(400).json({ message: msg });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const userIdRaw = req.body?.userId;
  const userId = userIdRaw != null && userIdRaw !== "" ? Number(userIdRaw) : null;

  if (!email && !userId) return res.status(400).json({ message: "Provide email or userId" });
  if (email && userId) return res.status(400).json({ message: "Provide only one of email or userId" });

  const selector = email ? ({ email } as const) : ({ userId: userId! } as const);

  // Back up before deleting (same safety invariant as script).
  const payload = await exportPortfolioBackup(db as any, selector as any);
  const dir = path.join(process.cwd(), "backups/portfolio-reset");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `portfolio-backup-user-${payload.meta.user.id}-${Date.now()}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  const dryRun = Boolean(req.body?.dryRun);
  const result = await resetPortfolioData(db as any, selector as any, { dryRun });
  return res.json({
    ok: true,
    dryRun: result.dryRun,
    backupFile: filePath,
    deleted: result.deleted
  });
});
