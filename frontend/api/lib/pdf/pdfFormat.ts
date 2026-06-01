/** South African Rand formatting for PDF output (print-friendly, en-ZA grouping). */
export function formatPdfZar(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "R 0.00";
  return `R ${v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPdfDate(iso: string): string {
  const s = String(iso ?? "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toISOString().slice(0, 10);
}
