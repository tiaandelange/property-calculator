import { db } from "../../config/db.js";
import { isCurrentLeaseStatus, leaseDisplayStatus } from "./propertyLease.helpers.js";

export function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ymNext(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ymCompare(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Monthly compound step for nominal annual rate: balance × (1 + annual%/12). */
export function applyMonthlyGrowthFactor(balance: number, annualPercent: number): number {
  const factor = 1 + annualPercent / 100 / 12;
  return Math.round(balance * factor * 100) / 100;
}

type LeaseGrowthRow = {
  id: number;
  depositAmount: number;
  depositAnnualGrowthPercent: number | null;
  depositGrowthLastAppliedMonth: string | null;
  status: string;
  fixedTermEndDate: Date | null;
};

/**
 * Applies deposit growth for each elapsed calendar month since last application (catch-up).
 * First time growth % is set and lastApplied is null: anchors to current month without changing balance.
 */
export async function applyLeaseDepositGrowthIfDue(lease: LeaseGrowthRow): Promise<void> {
  const pct = lease.depositAnnualGrowthPercent;
  if (pct == null || pct <= 0 || Number.isNaN(pct)) return;

  const currentYm = ymNow();

  if (!lease.depositGrowthLastAppliedMonth) {
    await db.lease.update({
      where: { id: lease.id },
      data: { depositGrowthLastAppliedMonth: currentYm }
    });
    return;
  }

  let balance = lease.depositAmount;
  let lastYm = lease.depositGrowthLastAppliedMonth;
  let cursor = ymNext(lastYm);
  let applied = 0;

  while (ymCompare(cursor, currentYm) <= 0 && applied < 2400) {
    balance = applyMonthlyGrowthFactor(balance, pct);
    lastYm = cursor;
    cursor = ymNext(cursor);
    applied++;
  }

  if (applied > 0) {
    await db.lease.update({
      where: { id: lease.id },
      data: {
        depositAmount: balance,
        depositGrowthLastAppliedMonth: currentYm
      }
    });
  }
}

export async function applyDepositGrowthForCurrentPropertyLeases(userId: number, propertyId: number): Promise<void> {
  const leases = await db.lease.findMany({
    where: { userId, propertyId },
    select: {
      id: true,
      depositAmount: true,
      depositAnnualGrowthPercent: true,
      depositGrowthLastAppliedMonth: true,
      status: true,
      fixedTermEndDate: true
    }
  });

  for (const lease of leases) {
    const disp = leaseDisplayStatus({ status: lease.status, fixedTermEndDate: lease.fixedTermEndDate });
    if (!isCurrentLeaseStatus(disp)) continue;
    await applyLeaseDepositGrowthIfDue(lease as LeaseGrowthRow);
  }
}
