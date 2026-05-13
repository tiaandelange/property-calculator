/** UTC [start, end) for a calendar month — mirrors `propertyExpenseMonth.helpers.ts` for SPA summaries. */
export function utcCalendarMonthBounds(
  calendarMonthYyyyMm: string | null | undefined,
  fallbackInstant: Date
): { start: Date; end: Date } {
  const ym = calendarMonthYyyyMm?.trim();
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const y = Number(ym.slice(0, 4));
    const mo = Number(ym.slice(5, 7));
    if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      return {
        start: new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0)),
        end: new Date(Date.UTC(y, mo, 1, 0, 0, 0))
      };
    }
  }
  const y = fallbackInstant.getUTCFullYear();
  const m0 = fallbackInstant.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(y, m0 + 1, 1, 0, 0, 0))
  };
}
