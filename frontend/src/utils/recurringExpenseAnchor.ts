export type RecurringExpenseMonthAnchor = "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function anchorYmdInMonthUtc(
  year: number,
  month0: number,
  anchor: RecurringExpenseMonthAnchor,
  dayOfMonth?: number | null
): string {
  if (anchor === "FIRST_OF_MONTH") return `${year}-${pad(month0 + 1)}-01`;
  if (anchor === "LAST_OF_MONTH") {
    const lastDay = daysInMonthUtc(year, month0);
    return `${year}-${pad(month0 + 1)}-${pad(lastDay)}`;
  }
  const dim = daysInMonthUtc(year, month0);
  const dom = Math.min(Math.max(1, Number(dayOfMonth) || 1), 31);
  const d = Math.min(dom, dim);
  return `${year}-${pad(month0 + 1)}-${pad(d)}`;
}

function parseYmd(ymd: string): { y: number; m0: number } {
  const [y, m] = ymd.split("-").map(Number);
  return { y, m0: m - 1 };
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

function nextCalendarMonthUtc(y: number, m0: number): { y: number; m0: number } {
  const d = new Date(Date.UTC(y, m0 + 1, 1));
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth() };
}

/** First anchor date (YYYY-MM-DD) on or after `startYmd`. */
export function firstDueYmdOnOrAfter(
  startYmd: string,
  anchor: RecurringExpenseMonthAnchor,
  dayOfMonth?: number | null
): string {
  let { y, m0 } = parseYmd(startYmd);
  for (let i = 0; i < 600; i++) {
    const due = anchorYmdInMonthUtc(y, m0, anchor, dayOfMonth);
    if (compareYmd(due, startYmd) >= 0) return due;
    ({ y, m0 } = nextCalendarMonthUtc(y, m0));
  }
  const { y: yy, m0: mm } = parseYmd(startYmd);
  return anchorYmdInMonthUtc(yy, mm, anchor, dayOfMonth);
}

export function ymdToUtcNoonIso(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(ymd).toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
}
