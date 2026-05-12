/** Shared parsers for property HTTP payloads */

export function asNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
