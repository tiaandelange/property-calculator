export function statementSendButtonLabel(): string {
  return "Send";
}

export function statementSendSuccessMessage(): string {
  return "Statement sent.";
}

export function defaultStatementEmailSubject(opts: {
  statementType: "FINANCIAL" | "DEPOSIT";
  propertyName?: string | null;
  statementNumber: string;
}): string {
  const kind = opts.statementType === "DEPOSIT" ? "Deposit statement" : "Financial statement";
  const prop = opts.propertyName?.trim();
  return prop ? `${kind} — ${prop} (${opts.statementNumber})` : `${kind} (${opts.statementNumber})`;
}

export function defaultStatementEmailMessage(opts: {
  tenantFirstName?: string | null;
  statementType: "FINANCIAL" | "DEPOSIT";
  propertyName?: string | null;
  periodLabel?: string | null;
  userOrBusinessName?: string | null;
}): string {
  const name = opts.tenantFirstName?.trim() || "there";
  const kind = opts.statementType === "DEPOSIT" ? "deposit statement" : "financial statement";
  const prop = opts.propertyName?.trim();
  const period = opts.periodLabel?.trim();
  const from = opts.userOrBusinessName?.trim() || "your landlord";
  const lines = [
    `Hi ${name},`,
    "",
    `Please find attached your ${kind}${prop ? ` for ${prop}` : ""}${period ? ` covering ${period}` : ""}.`,
    "",
    "If you have any questions, reply to this email.",
    "",
    `Kind regards,`,
    from
  ];
  return lines.join("\n");
}
