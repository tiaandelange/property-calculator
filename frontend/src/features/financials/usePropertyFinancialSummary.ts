import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { asArray } from "../../lib/asArray";
import { queryKeys } from "../../lib/queryKeys";
import { listPropertyAdditionalBonds } from "../../services/propertyAdditionalBondsSupabase";
import { mapAdditionalBondPayments } from "../properties/financials/propertyBondAdapter";
import { selectLandlordRecurringCharges } from "../properties/financials/propertyFinancialsAdapter";
import { buildPropertyFinancialSummary } from "./buildPropertyFinancialSummary";
import type { PropertyFinancialSummary } from "./financialTypes";

export type UsePropertyFinancialSummaryParams = {
  propertyId: string;
  propertyDetail: Record<string, unknown> | null | undefined;
  currentLeases: unknown[];
  statement: Record<string, unknown> | null | undefined;
  enabled?: boolean;
  /** When additional bonds are already loaded (e.g. Financials tab local state), skip the query. */
  additionalBondMonthlyTotal?: number;
};

export function usePropertyFinancialSummary({
  propertyId,
  propertyDetail,
  currentLeases,
  statement,
  enabled = true,
  additionalBondMonthlyTotal: additionalBondMonthlyTotalOverride
}: UsePropertyFinancialSummaryParams): {
  summary: PropertyFinancialSummary | null;
  additionalBondsLoading: boolean;
} {
  const bondsQueryEnabled = enabled && Boolean(propertyId) && additionalBondMonthlyTotalOverride == null;

  const bondsQuery = useQuery({
    queryKey: queryKeys.propertyAdditionalBonds(propertyId),
    queryFn: () => listPropertyAdditionalBonds(propertyId),
    enabled: bondsQueryEnabled
  });

  const recurringChargesLandlord = useMemo(
    () => selectLandlordRecurringCharges(asArray(statement?.recurringCharges)),
    [statement]
  );

  const deposits = useMemo(() => asArray(statement?.deposits), [statement]);

  const additionalBondMonthlyTotal = useMemo(() => {
    if (additionalBondMonthlyTotalOverride != null) return additionalBondMonthlyTotalOverride;
    const bonds = bondsQuery.data ?? [];
    return mapAdditionalBondPayments(bonds).reduce((a, b) => a + b.monthlyPayment, 0);
  }, [additionalBondMonthlyTotalOverride, bondsQuery.data]);

  const summary = useMemo(() => {
    if (!propertyDetail) return null;
    return buildPropertyFinancialSummary({
      propertyId,
      propertyDetail,
      currentLeases,
      recurringChargesLandlord,
      statement: statement ?? null,
      deposits,
      additionalBondMonthlyTotal
    });
  }, [
    propertyId,
    propertyDetail,
    currentLeases,
    recurringChargesLandlord,
    statement,
    deposits,
    additionalBondMonthlyTotal
  ]);

  return {
    summary,
    additionalBondsLoading: bondsQueryEnabled && bondsQuery.isLoading
  };
}
