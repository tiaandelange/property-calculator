export type StatementPeriodPreset =
  | "LAST_MONTH"
  | "SIX_MONTHS"
  | "YTD"
  | "TWELVE_MONTHS"
  | "PER_YEAR"
  | "FOREVER";

export type StatementPeriodRange = {
  startDate: string;
  endDate: string;
};

function utcYmdFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcTodayYmd(now: Date): string {
  return utcYmdFromParts(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function utcMonthStartYmd(now: Date, monthsBack: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return utcYmdFromParts(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Maps Statement tab presets to inclusive UTC calendar dates (YYYY-MM-DD). */
export function resolveStatementPeriodRange(
  preset: StatementPeriodPreset,
  year: number,
  now: Date = new Date()
): StatementPeriodRange {
  const today = utcTodayYmd(now);

  if (preset === "LAST_MONTH") {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return {
      startDate: utcYmdFromParts(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
      endDate: utcYmdFromParts(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
    };
  }

  if (preset === "PER_YEAR") {
    return {
      startDate: utcYmdFromParts(year, 0, 1),
      endDate: utcYmdFromParts(year, 11, 31)
    };
  }

  if (preset === "YTD") {
    return {
      startDate: utcYmdFromParts(now.getUTCFullYear(), 0, 1),
      endDate: today
    };
  }

  if (preset === "TWELVE_MONTHS" || preset === "FOREVER") {
    return { startDate: utcMonthStartYmd(now, 11), endDate: today };
  }

  if (preset === "SIX_MONTHS") {
    return { startDate: utcMonthStartYmd(now, 5), endDate: today };
  }

  return { startDate: today, endDate: today };
}
