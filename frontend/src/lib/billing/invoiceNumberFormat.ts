/** UI keys — stored in DB as template strings with {####} token. */
export type InvoiceNumberFormatKey =
  | "INV-YY-###"
  | "INV-####"
  | "INV-YYMM-###"
  | "INV-YYYY-###";

export const INVOICE_NUMBER_FORMAT_OPTIONS: Array<{
  key: InvoiceNumberFormatKey;
  label: string;
}> = [
  { key: "INV-YY-###", label: "INV-YY-###" },
  { key: "INV-####", label: "INV-####" },
  { key: "INV-YYMM-###", label: "INV-YYMM-###" },
  { key: "INV-YYYY-###", label: "INV-YYYY-###" }
];

const DEFAULT_DB_FORMAT = "INV-YY-{####}";

export function formatKeyToDbString(key: InvoiceNumberFormatKey): string {
  switch (key) {
    case "INV-YY-###":
      return "INV-YY-{####}";
    case "INV-####":
      return "INV-{####}";
    case "INV-YYMM-###":
      return "INV-YYMM-{####}";
    case "INV-YYYY-###":
      return "INV-YYYY-{####}";
    default:
      return DEFAULT_DB_FORMAT;
  }
}

export function dbStringToFormatKey(db: string | null | undefined): InvoiceNumberFormatKey {
  const normalized = String(db ?? "").trim();
  if (normalized === "INV-{####}") return "INV-####";
  if (normalized === "INV-YYMM-{####}") return "INV-YYMM-###";
  if (normalized === "INV-YYYY-{####}") return "INV-YYYY-###";
  return "INV-YY-###";
}

/** Client-side preview (server assigns the next sequence on create). */
export function previewInvoiceNumber(
  formatKey: InvoiceNumberFormatKey,
  sequence = 7,
  date = new Date()
): string {
  const yy = String(date.getFullYear()).slice(-2);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const seq3 = String(sequence).padStart(3, "0");
  const seq4 = String(sequence).padStart(4, "0");

  switch (formatKey) {
    case "INV-YY-###":
      return `INV-${yy}-${seq3}`;
    case "INV-####":
      return `INV-${seq4}`;
    case "INV-YYMM-###":
      return `INV-${yy}${mm}-${seq3}`;
    case "INV-YYYY-###":
      return `INV-${yyyy}-${seq3}`;
    default:
      return `INV-${yy}-${seq3}`;
  }
}
