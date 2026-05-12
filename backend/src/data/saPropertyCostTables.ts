/**
 * Versioned South African property transaction cost tables.
 *
 * Transfer duty brackets: SARS effective 1 April 2026 (per product spec).
 *
 * Deeds Office registration fees: schedule “1 Apr 2026 – 28 Feb 2027” (Government Gazette 54225 / amended
 * Schedule of Fees of Office), as tabulated on public conveyancing references (e.g. Cape Town Lawyer fee pages).
 * Update `DEEDS_*_FEE_YEAR` rows when Gazette tables change.
 */

export const TRANSFER_DUTY_EFFECTIVE_LABEL = "SARS transfer duty brackets effective 1 April 2026";

/** Bracket upper bounds (ZAR) and cumulative formula parameters — informational; logic lives in `calculateTransferDutySA`. */
export const TRANSFER_DUTY_2026_2027 = {
  effectiveFrom: "2026-04-01",
  brackets: [
    { upTo: 1_210_000, rate: 0, base: 0, threshold: 0 },
    { upTo: 1_663_800, rate: 0.03, base: 0, threshold: 1_210_000 },
    { upTo: 2_329_300, rate: 0.06, base: 13_614, threshold: 1_663_800 },
    { upTo: 2_994_800, rate: 0.08, base: 53_544, threshold: 2_329_300 },
    { upTo: 13_310_000, rate: 0.11, base: 106_784, threshold: 2_994_800 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.13, base: 1_241_456, threshold: 13_310_000 }
  ]
} as const;

export type DeedsFeeYearKey = "2026_2027" | "2025_2026";

/** Purchase consideration / fair value column for transfer registration (2026–2027). */
export const DEEDS_TRANSFER_FEES_2026_2027: ReadonlyArray<{ min: number; max: number; fee: number }> = [
  { min: 0, max: 100_000, fee: 50 },
  { min: 100_001, max: 200_000, fee: 114 },
  { min: 200_001, max: 300_000, fee: 727 },
  { min: 300_001, max: 600_000, fee: 956 },
  { min: 600_001, max: 800_000, fee: 1346 },
  { min: 800_001, max: 1_000_000, fee: 1546 },
  { min: 1_000_001, max: 2_000_000, fee: 1738 },
  { min: 2_000_001, max: 4_000_000, fee: 2408 },
  { min: 4_000_001, max: 6_000_000, fee: 2922 },
  { min: 6_000_001, max: 8_000_000, fee: 3480 },
  { min: 8_000_001, max: 10_000_000, fee: 4068 },
  { min: 10_000_001, max: 15_000_000, fee: 4844 },
  { min: 15_000_001, max: 20_000_000, fee: 5818 },
  { min: 20_000_001, max: Number.MAX_SAFE_INTEGER, fee: 7751 }
];

/** Bond capital amount column for bond registration (2026–2027). */
export const DEEDS_BOND_FEES_2026_2027: ReadonlyArray<{ min: number; max: number; fee: number }> = [
  { min: 0, max: 150_000, fee: 561 },
  { min: 150_001, max: 300_000, fee: 727 },
  { min: 300_001, max: 600_000, fee: 956 },
  { min: 600_001, max: 800_000, fee: 1346 },
  { min: 800_001, max: 1_000_000, fee: 1546 },
  { min: 1_000_001, max: 2_000_000, fee: 1738 },
  { min: 2_000_001, max: 4_000_000, fee: 2408 },
  { min: 4_000_001, max: 6_000_000, fee: 2922 },
  { min: 6_000_001, max: 8_000_000, fee: 3480 },
  { min: 8_000_001, max: 10_000_000, fee: 4068 },
  { min: 10_000_001, max: 15_000_000, fee: 4844 },
  { min: 15_000_001, max: 20_000_000, fee: 5818 },
  { min: 20_000_001, max: 30_000_000, fee: 6781 },
  { min: 30_000_001, max: Number.MAX_SAFE_INTEGER, fee: 9690 }
];

export const DEEDS_FEE_TABLES: Record<DeedsFeeYearKey, { transfer: typeof DEEDS_TRANSFER_FEES_2026_2027; bond: typeof DEEDS_BOND_FEES_2026_2027 }> = {
  "2026_2027": { transfer: DEEDS_TRANSFER_FEES_2026_2027, bond: DEEDS_BOND_FEES_2026_2027 },
  /** Alias: keep prior year tables if needed later; currently same 2026–2027 data for bond/transfer lookups. */
  "2025_2026": { transfer: DEEDS_TRANSFER_FEES_2026_2027, bond: DEEDS_BOND_FEES_2026_2027 }
};
