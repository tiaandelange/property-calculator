/**
 * Print-oriented PDF theme — uses workspace accent colour from settings only.
 * Never reads light/dark UI mode; PDFs always use a white background.
 */

export type GlobalPdfTheme = {
  primaryColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  tableHeaderFill: string;
  tableHeaderText: string;
  lightFill: string;
  zebraFill: string;
  successColor: string;
  dangerColor: string;
  backgroundColor: string;
  fontFamily: string;
};

export type PdfThemeInput = {
  /** Settings → Appearance accent id (purple, blue, green, …). */
  accentColor?: string | null;
};

const FALLBACK_PRIMARY = "#7c5cff";
const FALLBACK_ACCENT = "#0f172a";

/** Light-workspace primary colours (print-friendly; not tied to dark mode tokens). */
const ACCENT_PALETTE: Record<string, { primary: string; soft: string }> = {
  purple: { primary: "#7c5cff", soft: "#ede9fe" },
  blue: { primary: "#2563eb", soft: "#dbeafe" },
  green: { primary: "#16a34a", soft: "#dcfce7" },
  orange: { primary: "#ea580c", soft: "#ffedd5" },
  red: { primary: "#dc2626", soft: "#fee2e2" },
  teal: { primary: "#0d9488", soft: "#ccfbf1" }
};

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validateHexColor(value: unknown, fallback: string): string {
  const s = String(value ?? "").trim();
  if (!HEX_RE.test(s)) return fallback;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}

function normalizeAccentKey(accent: string | null | undefined): string {
  const k = String(accent ?? "purple")
    .trim()
    .toLowerCase();
  return ACCENT_PALETTE[k] ? k : "purple";
}

export function accentPrimaryHex(accentColor?: string | null): string {
  const palette = ACCENT_PALETTE[normalizeAccentKey(accentColor)];
  return palette.primary;
}

export function accentSoftFillHex(accentColor?: string | null): string {
  const palette = ACCENT_PALETTE[normalizeAccentKey(accentColor)];
  return palette.soft;
}

export function buildGlobalPdfTheme(input: PdfThemeInput = {}): GlobalPdfTheme {
  const primary = validateHexColor(accentPrimaryHex(input.accentColor), FALLBACK_PRIMARY);
  const accent = validateHexColor(FALLBACK_ACCENT, FALLBACK_ACCENT);
  const tableHeaderFill = validateHexColor(accentSoftFillHex(input.accentColor), "#ede9fe");

  return {
    primaryColor: primary,
    accentColor: accent,
    textColor: "#111827",
    mutedTextColor: "#6b7280",
    borderColor: "#e5e7eb",
    tableHeaderFill,
    tableHeaderText: "#111827",
    lightFill: "#f9fafb",
    zebraFill: "#f3f4f6",
    successColor: "#166534",
    dangerColor: "#b91c1c",
    backgroundColor: "#ffffff",
    fontFamily: "Roboto"
  };
}
