/** Display label for embedded `property_units` rows (PostgREST or RPC). */
export function propertyUnitDisplayLabel(unit: Record<string, unknown> | null | undefined): string | null {
  if (!unit) return null;
  const name = String(unit.unitName ?? unit.unit_name ?? unit.unitLabel ?? unit.unit_label ?? "").trim();
  return name || null;
}
