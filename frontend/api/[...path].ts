import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler as handleBondAction } from "./_lib/handlers/bondAction.js";
import { handler as handleContact } from "./_lib/handlers/contact.js";
import { handler as handleCronRunDue } from "./_lib/handlers/cronRunDue.js";
import { handler as handleInvoicesGenerate } from "./_lib/handlers/invoicesGenerate.js";
import { handler as handleInvoicesSendEmail } from "./_lib/handlers/invoicesSendEmail.js";
import { handler as handleStatementsGenerate } from "./_lib/handlers/statementsGenerate.js";
import { handler as handleStatementsSendEmail } from "./_lib/handlers/statementsSendEmail.js";
import { handler as handleRecurringExpensesRunDue } from "./_lib/handlers/recurringExpensesRunDue.js";
import { handler as handleReportsGenerate } from "./_lib/handlers/reportsGenerate.js";
import { handler as handleSubscriptionAction } from "./_lib/handlers/subscriptionAction.js";

function pathSegments(req: VercelRequest): string[] {
  const raw = req.query.path;
  let parts: string[];
  if (Array.isArray(raw)) {
    parts = raw.map((segment) => String(segment));
  } else if (typeof raw === "string" && raw.length > 0) {
    parts = [raw];
  } else {
    return [];
  }
  // Vercel may pass catch-all as one string ("subscription/checkout") or as segments.
  return parts.flatMap((segment) => segment.split("/").filter(Boolean));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const segments = pathSegments(req);
  if (segments.length === 0) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const routeKey = segments.join("/");

  if (routeKey === "contact") {
    await handleContact(req, res);
    return;
  }

  if (routeKey === "cron/run-due") {
    await handleCronRunDue(req, res);
    return;
  }

  if (routeKey === "invoices/generate") {
    await handleInvoicesGenerate(req, res);
    return;
  }

  if (routeKey === "statements/generate") {
    await handleStatementsGenerate(req, res);
    return;
  }

  if (routeKey === "recurring-expenses/run-due") {
    await handleRecurringExpensesRunDue(req, res);
    return;
  }

  if (routeKey === "reports/generate") {
    await handleReportsGenerate(req, res);
    return;
  }

  if (segments.length === 3 && segments[0] === "invoices" && segments[2] === "send-email") {
    req.query.id = segments[1];
    await handleInvoicesSendEmail(req, res);
    return;
  }

  if (segments.length === 3 && segments[0] === "statements" && segments[2] === "send-email") {
    req.query.id = segments[1];
    await handleStatementsSendEmail(req, res);
    return;
  }

  if (segments.length === 4 && segments[0] === "properties" && segments[2] === "bond") {
    req.query.propertyId = segments[1];
    req.query.action = segments[3];
    await handleBondAction(req, res);
    return;
  }

  if (segments.length === 2 && segments[0] === "subscription" && segments[1] !== "webhook") {
    req.query.action = segments[1];
    await handleSubscriptionAction(req, res);
    return;
  }

  res.status(404).json({ error: "Not found." });
}
