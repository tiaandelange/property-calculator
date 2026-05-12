import { db } from "../config/db.js";

/**
 * Load landlord invoice payment JSON when the DB column exists (after migrations).
 * Returns null if the column is missing or the query fails — keeps PDF/auth working on older databases.
 */
export async function readInvoicePaymentDetails(userId: number): Promise<unknown> {
  try {
    const rows = await db.$queryRaw<Array<{ invoice_payment_details: unknown }>>`
      SELECT invoice_payment_details FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    return rows[0]?.invoice_payment_details ?? null;
  } catch {
    return null;
  }
}
