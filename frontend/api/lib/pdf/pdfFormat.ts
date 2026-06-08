/** South African Rand formatting for PDF output (print-friendly, en-ZA grouping). */
export function formatPdfZar(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v + Number.EPSILON);
  return `R ${rounded.toLocaleString("en-ZA", { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

export function formatPdfPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n).toFixed(2)}%`;
}

/** Parse a ZAR display string (en-ZA: space thousands, comma decimal) back to rands. */
export function parsePdfZar(display: unknown): number | null {
  if (typeof display === "number") return Number.isFinite(display) ? display : null;
  const raw = String(display ?? "").trim();
  if (!raw || raw === "—") return null;
  const body = raw.replace(/^R\s*/i, "").trim();
  const normalized = body.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatPdfDate(iso: string): string {
  const s = String(iso ?? "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toISOString().slice(0, 10);
}
