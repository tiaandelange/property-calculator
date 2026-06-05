/**
 * Pre-filled values when opening a calculator route.
 * Sourced from the universal demo property profile in `@calculatorShared/universalDemoProperty`.
 */

import {
  TRANSFER_BOND_DEFAULTS,
  buildUniversalCalculatorDefaults
} from "@calculatorShared/universalDemoProperty";

export { TRANSFER_BOND_DEFAULTS };

/** @deprecated Use `buildUniversalCalculatorDefaults` — kept for imports expecting a static map. */
export const CALCULATOR_DEFAULT_VALUES: Record<string, Record<string, unknown>> = new Proxy(
  {},
  {
    get(_target, slug: string) {
      return buildUniversalCalculatorDefaults(slug);
    }
  }
);

export function getCalculatorDefaultValues(slug: string): Record<string, unknown> {
  const base = buildUniversalCalculatorDefaults(slug);
  if (!base || Object.keys(base).length === 0) return {};
  if (slug === "noi") return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  return { ...base };
}
