import type { FieldDef } from "../data/calculators";

export function selectFieldCoerceValue(field: FieldDef, raw: string): string | number {
  if (raw === "") return "";
  if (field.type !== "select") return Number(raw);
  const stringSelectKeys = new Set([
    "transactionType",
    "buyerType",
    "feeYear",
    "attorneyFeeMode",
    "propertyUse"
  ]);
  if (stringSelectKeys.has(field.key)) return raw;
  return Number(raw);
}
