import type { CalculatorReportPayload } from "./calculatorReportPayload";

const KEY_PREFIX = "pg.calculators.reportPayload.v1.";

export function saveCalculatorReportPayload(payload: CalculatorReportPayload): string {
  const id = crypto.randomUUID();
  sessionStorage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(payload));
  return id;
}

export function loadCalculatorReportPayload(id: string): CalculatorReportPayload | null {
  const raw = sessionStorage.getItem(`${KEY_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CalculatorReportPayload;
  } catch {
    return null;
  }
}

