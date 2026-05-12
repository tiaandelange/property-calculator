import { db } from "../../config/db.js";
import { isCurrentLeaseStatus, leaseDisplayStatus } from "./propertyLease.helpers.js";

/** Draft invoice for a specific lease (calendar month); duplicate blocked per lease + month. */
export async function createDraftInvoiceForLease(userId: number, propertyId: number, leaseId: number) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, userId, propertyId },
    include: { tenant: true }
  });
  if (!lease) return { ok: false as const, message: "Lease not found on this property." };

  const disp = leaseDisplayStatus({ status: lease.status, fixedTermEndDate: lease.fixedTermEndDate });
  if (!isCurrentLeaseStatus(disp)) return { ok: false as const, message: "Only active leases can be invoiced." };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const dup = await db.invoice.findFirst({
    where: {
      userId,
      propertyId,
      leaseId,
      invoiceDate: { gte: monthStart, lt: monthEnd },
      status: { notIn: ["CANCELLED"] }
    }
  });
  if (dup)
    return {
      ok: false as const,
      message: "An invoice already exists for this lease in this calendar month.",
      invoiceId: dup.id
    };

  const invNo = `INV-${propertyId}-${leaseId}-${monthStart.toISOString().slice(0, 7)}-${Date.now().toString(36)}`;
  const dueDay = Math.min(Math.max(lease.rentDueDay, 1), 28);
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);

  const invoice = await db.invoice.create({
    data: {
      userId,
      propertyId,
      tenantId: lease.tenantId,
      leaseId: lease.id,
      invoiceNumber: invNo,
      invoiceDate: monthStart,
      dueDate,
      status: "DRAFT",
      subtotal: lease.monthlyRent,
      total: lease.monthlyRent,
      notes: null,
      lineItems: {
        create: [{ description: "Monthly rent", quantity: 1, unitPrice: lease.monthlyRent, total: lease.monthlyRent }]
      }
    },
    include: { lineItems: true, tenant: true, lease: true }
  });

  return { ok: true as const, invoice };
}

/** First active lease on property (backward compatible). */
export async function createDraftInvoiceFromCurrentLease(userId: number, propertyId: number) {
  const leases = await db.lease.findMany({
    where: { userId, propertyId },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  });
  const current = leases.find((l) =>
    isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))
  );
  if (!current) return { ok: false as const, message: "No current lease on this property." };
  return createDraftInvoiceForLease(userId, propertyId, current.id);
}
