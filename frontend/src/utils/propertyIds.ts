/**
 * Express / Prisma property routes use numeric ids. Supabase `properties.id` is a UUID string.
 * Use this helper when calling legacy Express APIs that still expect an integer property id.
 */
export function legacyExpressPropertyId(id: string | number | undefined | null): number | null {
  if (id == null || id === "") return null;
  const s = String(id).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
