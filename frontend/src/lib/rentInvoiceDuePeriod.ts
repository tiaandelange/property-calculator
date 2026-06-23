/** Date-only rent invoice window helpers (UTC calendar YYYY-MM-DD). */

export type RentDuePeriodCandidate = {
  dueDate: string;
  periodKey: string;
  generationDate: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Clamp rent due day to valid calendar day for year/month (1-based month). */
export function leaseRentDueDateYmd(year: number, month1: number, rentDueDay: number): string {
  const dom = Math.min(Math.max(rentDueDay || 1, 1), 31);
  const lastDom = daysInMonth(year, month1);
  const day = Math.min(dom, lastDom);
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

export function periodKeyFromDueDate(dueDateYmd: string): string {
  return dueDateYmd.slice(0, 7);
}

export function addMonthsToMonthStart(ymd: string, offsetMonths: number): string {
  const [y, m] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
}

export function subtractDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Candidate due periods around today (previous, current, next calendar month anchors). */
export function rentDuePeriodCandidates(
  todayYmd: string,
  rentDueDay: number,
  daysBeforeDue: number
): RentDuePeriodCandidate[] {
  const monthStart = `${todayYmd.slice(0, 7)}-01`;
  const offsets = [-1, 0, 1];
  const out: RentDuePeriodCandidate[] = [];

  for (const offset of offsets) {
    const anchor = addMonthsToMonthStart(monthStart, offset);
    const [year, month1] = anchor.split("-").map(Number);
    const dueDate = leaseRentDueDateYmd(year, month1, rentDueDay);
    out.push({
      dueDate,
      periodKey: periodKeyFromDueDate(dueDate),
      generationDate: subtractDaysYmd(dueDate, daysBeforeDue)
    });
  }

  return out;
}

export function isInGenerationWindow(todayYmd: string, generationDateYmd: string): boolean {
  return compareYmd(todayYmd, generationDateYmd) >= 0;
}

export function isDueDateOnOrAfterLeaseStart(dueDateYmd: string, leaseStartYmd: string | null): boolean {
  if (!leaseStartYmd) return true;
  return compareYmd(dueDateYmd, leaseStartYmd) >= 0;
}

export function shouldGenerateRentInvoice(params: {
  todayYmd: string;
  rentDueDay: number;
  daysBeforeDue: number;
  leaseStartYmd: string | null;
  leaseEndYmd?: string | null;
  leaseActive: boolean;
  invoiceExists: boolean;
}): { generate: boolean; dueDate?: string; periodKey?: string; reason?: string } {
  if (!params.leaseActive) {
    return { generate: false, reason: "lease_inactive" };
  }
  if (params.invoiceExists) {
    return { generate: false, reason: "invoice_exists" };
  }

  for (const candidate of rentDuePeriodCandidates(params.todayYmd, params.rentDueDay, params.daysBeforeDue)) {
    if (!isInGenerationWindow(params.todayYmd, candidate.generationDate)) {
      continue;
    }
    if (!isDueDateOnOrAfterLeaseStart(candidate.dueDate, params.leaseStartYmd)) {
      continue;
    }
    if (params.leaseEndYmd && compareYmd(candidate.dueDate, params.leaseEndYmd) > 0) {
      continue;
    }
    return { generate: true, dueDate: candidate.dueDate, periodKey: candidate.periodKey };
  }

  return { generate: false, reason: "not_in_window" };
}
