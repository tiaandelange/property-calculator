import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { db } from "../config/db.js";

export const userRoutes = Router();

userRoutes.patch("/profile", authRequired, async (req: AuthRequest, res) => {
  try {
    const raw = req.body?.invoicePaymentDetails;
    if (raw !== undefined && raw !== null && typeof raw !== "object") {
      return res.status(400).json({ message: "invoicePaymentDetails must be a JSON object." });
    }
    const schemeRaw = req.body?.uiColorScheme;
    if (schemeRaw !== undefined && schemeRaw !== "light" && schemeRaw !== "dark") {
      return res.status(400).json({ message: 'uiColorScheme must be "light" or "dark".' });
    }

    const data: Prisma.UserUpdateInput = {};
    if (raw !== undefined) {
      data.invoicePaymentDetails = raw as Prisma.InputJsonValue;
    }
    if (schemeRaw !== undefined) {
      data.uiColorScheme = schemeRaw;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Provide invoicePaymentDetails and/or uiColorScheme." });
    }

    const updated = await db.user.update({
      where: { id: req.userId! },
      data
    });
    return res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      invoicePaymentDetails: updated.invoicePaymentDetails ?? null,
      uiColorScheme: updated.uiColorScheme === "light" ? "light" : "dark"
    });
  } catch (err: any) {
    console.error("[user] PATCH /profile failed", err?.stack ?? err);
    const msg = String(err?.message ?? "");
    if (msg.includes("invoice_payment_details")) {
      return res.status(503).json({
        message:
          'Database is missing column invoice_payment_details. From the backend folder run: npx prisma migrate dev — then retry.'
      });
    }
    if (msg.includes("ui_color_scheme")) {
      return res.status(503).json({
        message:
          'Database is missing column ui_color_scheme. From the backend folder run: npx prisma migrate dev — then retry.'
      });
    }
    return res.status(500).json({ message: "Could not update profile." });
  }
});

userRoutes.get("/reports", authRequired, async (req: AuthRequest, res) => {
  const reports = await db.calculation.findMany({
    where: { user_id: req.userId! },
    orderBy: { created_at: "desc" },
    select: { id: true, type: true, created_at: true, result_json: true, input_json: true }
  });
  const calcIds = reports.map((r) => r.id);
  const stored = calcIds.length
    ? await db.storedReport.findMany({
        where: { userId: req.userId!, calculationId: { in: calcIds } },
        orderBy: { createdAt: "desc" }
      })
    : [];

  const latestByCalc = new Map<number, { id: number; fileName: string }>();
  for (const s of stored) {
    if (s.calculationId != null && !latestByCalc.has(s.calculationId)) {
      latestByCalc.set(s.calculationId, { id: s.id, fileName: s.fileName });
    }
  }

  res.json(
    reports.map((r) => {
      const latest = latestByCalc.get(r.id);
      return {
        id: r.id,
        type: r.type,
        created_at: r.created_at,
        hasPdf: Boolean(latest),
        reportId: latest?.id ?? null,
        downloadUrl: latest ? `/api/reports/${latest.id}/download` : null,
        input: JSON.parse(r.input_json),
        result: JSON.parse(r.result_json)
      };
    })
  );
});

userRoutes.delete("/reports/:id", authRequired, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.calculation.findFirst({ where: { id, user_id: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await db.calculation.delete({ where: { id } });
  res.json({ message: "Deleted" });
});
