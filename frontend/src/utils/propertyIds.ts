const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(String(s).trim());
}

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
