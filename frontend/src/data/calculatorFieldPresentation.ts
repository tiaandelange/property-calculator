import type { FieldDef } from "./calculators";

export type FieldSliderConfig = {
  min: number;
  max: number;
  step: number;
};

const ADVANCED_SUBTITLES: Partial<Record<string, string>> = {
  "cash-flow": "Bond rate & term, insurance, levies, growth and other expenses",
  "monthly-payment": "Extra payments and optional scenario name",
  "buy-vs-rent": "Rent escalation and optional assumptions"
};

const SLIDER_BY_SLUG: Partial<Record<string, Partial<Record<string, FieldSliderConfig>>>> = {
  "cash-flow": {
    vacancyRatePercent: { min: 0, max: 30, step: 0.5 },
    propertyManagementPercent: { min: 0, max: 20, step: 0.5 }
  },
  "monthly-payment": {
    annualInterestRate: { min: 5, max: 22, step: 0.1 }
  },
  "buy-vs-rent": {
    interestRate: { min: 5, max: 22, step: 0.1 },
    propertyAppreciation: { min: 0, max: 15, step: 0.5 },
    rentEscalation: { min: 0, max: 15, step: 0.5 }
  }
};

/** Strip currency/percent hints from labels — adornments handle units. */
export function cleanCalculatorFieldLabel(label: string): string {
  return label
    .replace(/\s*\(R\)\s*(\(optional\))?/gi, "")
    .replace(/\s*\(optional, R\)\s*/gi, "")
    .replace(/\s*\(optional\)\s*/gi, "")
    .replace(/\s*\(%\)\s*/gi, "")
    .replace(/\s*\(% of income\)\s*/gi, "")
    .replace(/\s*\(optional, %\)\s*/gi, "")
    .replace(/\s*\(negative, R\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCalculatorFieldAdornment(field: FieldDef): { prefix?: string; suffix?: string } {
  if (field.type === "money") return { prefix: "R" };
  if (field.type === "percent") return { suffix: "%" };
  return {};
}

export function getCalculatorFieldSlider(slug: string, fieldKey: string): FieldSliderConfig | undefined {
  return SLIDER_BY_SLUG[slug]?.[fieldKey];
}

export function getCalculatorAdvancedSubtitle(slug: string): string {
  return (
    ADVANCED_SUBTITLES[slug] ??
    "Taxes, fees, inflation, insurance and optional assumptions"
  );
}

export function parseCalculatorNumericInput(raw: string): number | "" {
  const t = raw.trim().replace(/,/g, "").replace(/\s/g, "");
  if (t === "" || t === "-") return "";
  const n = Number(t);
  return Number.isFinite(n) ? n : "";
}

export function partitionFieldKeysBySlider(slug: string, keys: string[]): { plain: string[]; sliders: string[] } {
  const plain: string[] = [];
  const sliders: string[] = [];
  for (const key of keys) {
    if (getCalculatorFieldSlider(slug, key)) sliders.push(key);
    else plain.push(key);
  }
  return { plain, sliders };
}

export function formatCalculatorNumericDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return "";
  return String(n);
}
