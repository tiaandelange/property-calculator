const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string): boolean {
  return YMD_RE.test(s);
}

export function expenseDateFromYmd(ymd: string): Date {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
}

/** UTC bounds [gte, lt) covering the calendar month of `dueYmd`. */
export function utcMonthBoundsForDueYmd(dueYmd: string): { gte: string; lt: string } {
  const y = Number(dueYmd.slice(0, 4));
  const m = Number(dueYmd.slice(5, 7));
  const gte = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
  const lt = new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
  return { gte, lt };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysInUtcMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function dueYmdForCalendarMonth(year: number, month1Based: number, preferredDom: number): string {
  const dim = daysInUtcMonth(year, month1Based);
  const d = Math.min(Math.max(1, Math.floor(preferredDom)), dim);
  return `${year}-${pad2(month1Based)}-${pad2(d)}`;
}

export function enumerateBondDueYmdsInRange(startYmd: string, endYmd: string): string[] {
  const sy = Number(startYmd.slice(0, 4));
  const sm = Number(startYmd.slice(5, 7));
  const sd = Number(startYmd.slice(8, 10));
  const ey = Number(endYmd.slice(0, 4));
  const em = Number(endYmd.slice(5, 7));
  const startKey = sy * 12 + sm;
  const endKey = ey * 12 + em;
  if (startKey > endKey) return [];

  const out: string[] = [];
  let y = sy;
  let m = sm;
  while (y * 12 + m <= endKey) {
    out.push(dueYmdForCalendarMonth(y, m, sd));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
