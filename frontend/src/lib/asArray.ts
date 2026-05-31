/** Coerce API/cache values to arrays — prevents `.map` crashes when `?? []` leaves a non-array. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}
