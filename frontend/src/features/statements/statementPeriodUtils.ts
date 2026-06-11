import type { StatementPeriodKey } from "./statementTypes";

function padYm(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-ZA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function resolveStatementDocumentPeriod(
  key: StatementPeriodKey,
  leaseStartDate?: string | null
): { start: Date; end: Date; label: string; startYmd: string; endYmd: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  let start: Date;

  if (key === "last_3_months") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  } else if (key === "last_6_months") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  } else if (key === "last_12_months") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  } else if (key === "year_to_date") {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    const ls = leaseStartDate ? parseYmd(String(leaseStartDate).slice(0, 10)) : null;
    start = ls ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const startYmd = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
  const endYmd = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;

  return {
    start,
    end,
    label: formatPeriodLabel(start, end),
    startYmd,
    endYmd
  };
}

export function statementPeriodMonths(key: StatementPeriodKey, leaseStartDate?: string | null): string[] {
  const { start, end } = resolveStatementDocumentPeriod(key, leaseStartDate);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= endMonth) {
    months.push(padYm(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
