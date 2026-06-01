import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildTenantStatementSummary,
  deriveTenantLeaseStatusFromData,
  deriveTenantPaymentStatus,
  loadTenantFinancialBundle
} from "../statement/tenantStatementAdapter";
import type { TenantStatementPeriodKey } from "../statement/tenantStatementTypes";
import type {
  TenantInvoiceListItem,
  TenantLedgerTransaction,
  TenantStatementSummary
} from "../statement/tenantStatementTypes";
import { GC_TIME_MS, STALE_TIME_STATEMENT_MS } from "../../../lib/queryClient";
import { queryKeys } from "../../../lib/queryKeys";
import { useProfileQuery, useTenantQuery } from "../../queries/useWorkspaceQueries";
import { useWorkspaceId } from "../../queries/useWorkspaceId";
import { resolveTenantPropertyId, resolveTenantPropertyName } from "../tenantPropertyContext";

export type TenantWorkspaceContext = {
  tenantId: string;
  tenant: Record<string, unknown>;
  currentLease: Record<string, unknown> | null;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  tenantLeaseIds: string[];
  singleTenantProperty: boolean;
  rentDueDay: number | null;
  profileName: string;
  invoicePaymentDetails: unknown;
};

function tenantContextFromQueries(
  tenantId: string,
  tenantPayload: { tenant: Record<string, unknown>; currentLease: Record<string, unknown> | null },
  profile: { name?: string | null; email?: string; invoicePaymentDetails?: unknown } | undefined
): TenantWorkspaceContext | null {
  const { tenant, currentLease } = tenantPayload;
  const propertyId = resolveTenantPropertyId(tenant, currentLease);
  if (!propertyId) return null;

  const property = (tenant.property ?? null) as Record<string, unknown> | null;
  const leases = (tenant.leases ?? []) as Record<string, unknown>[];
  const tenantLeaseIds = leases.map((l) => String(l.id)).filter(Boolean);
  if (currentLease?.id) {
    const lid = String(currentLease.id);
    if (!tenantLeaseIds.includes(lid)) tenantLeaseIds.push(lid);
  }

  const propertyName = resolveTenantPropertyName(tenant, currentLease);
  const unitRaw = property?.unitLabel ?? property?.unitNumber ?? property?.unit;
  const unitLabel = unitRaw ? `${String(unitRaw)}, ${propertyName}` : propertyName;

  const rentDueDay =
    currentLease?.rentDueDay != null && Number.isFinite(Number(currentLease.rentDueDay))
      ? Number(currentLease.rentDueDay)
      : null;

  return {
    tenantId,
    tenant,
    currentLease,
    propertyId,
    propertyName,
    unitLabel,
    tenantLeaseIds,
    singleTenantProperty: tenantLeaseIds.length <= 1,
    rentDueDay,
    profileName: String(profile?.name ?? profile?.email ?? "Proplytic"),
    invoicePaymentDetails: profile?.invoicePaymentDetails ?? null
  };
}

export function useTenantWorkspaceData(
  tenantId: string | undefined,
  periodKey: TenantStatementPeriodKey,
  opts?: { loadFinancials?: boolean }
) {
  const loadFinancials = opts?.loadFinancials !== false;
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const tenantQuery = useTenantQuery(tenantId);
  const profileQuery = useProfileQuery();

  const tenantPayload = tenantQuery.data;
  const ctxBase = useMemo(() => {
    if (!tenantId || !tenantPayload) return null;
    return tenantContextFromQueries(tenantId, tenantPayload, profileQuery.data);
  }, [tenantId, tenantPayload, profileQuery.data]);

  const financialQuery = useQuery({
    queryKey:
      tenantId && ctxBase?.propertyId
        ? queryKeys.tenantStatement(tenantId, periodKey)
        : ["tenant-statement", "anonymous"],
    queryFn: () =>
      loadTenantFinancialBundle({
        propertyId: ctxBase!.propertyId,
        tenantId: tenantId!,
        tenantLeaseIds: ctxBase!.tenantLeaseIds,
        periodKey,
        leaseStartDate:
          ctxBase!.currentLease?.startDate != null ? String(ctxBase!.currentLease.startDate) : null,
        singleTenantProperty: ctxBase!.singleTenantProperty
      }),
    enabled: Boolean(workspaceId && tenantId && ctxBase?.propertyId && loadFinancials),
    staleTime: STALE_TIME_STATEMENT_MS,
    gcTime: GC_TIME_MS
  });

  const loading =
    (tenantQuery.isLoading && !tenantQuery.data) ||
    (loadFinancials && financialQuery.isLoading && !financialQuery.data);
  const error = tenantQuery.error
    ? tenantQuery.error instanceof Error
      ? tenantQuery.error.message
      : "Failed to load tenant."
    : financialQuery.error
      ? financialQuery.error instanceof Error
        ? financialQuery.error.message
        : "Failed to load tenant statement."
      : ctxBase === null && tenantPayload
        ? "This tenant is not linked to a property. Link a property to view financials."
        : "";

  const ctx = ctxBase;
  const bundle = financialQuery.data;

  const summary = useMemo((): TenantStatementSummary | null => {
    if (!ctx || !bundle || !tenantId) return null;
    const tenantName =
      `${String(ctx.tenant.firstName ?? "").trim()} ${String(ctx.tenant.lastName ?? "").trim()}`.trim() || "Tenant";
    return buildTenantStatementSummary({
      tenantId,
      tenantName,
      propertyId: ctx.propertyId,
      propertyName: ctx.propertyName,
      unitName: ctx.unitLabel,
      tenantStatus: String(ctx.tenant.status ?? ""),
      period: bundle.period,
      transactions: bundle.transactions,
      invoices: bundle.invoices,
      paymentLineItems: bundle.payments,
      rentDueDay: ctx.rentDueDay
    });
  }, [ctx, bundle, tenantId]);

  const transactions = bundle?.transactions ?? [];
  const invoices = bundle?.invoices ?? [];
  const payments = bundle?.payments ?? [];

  const leaseStatus = useMemo(() => {
    if (!ctx) return "inactive";
    return deriveTenantLeaseStatusFromData(ctx.currentLease, invoices);
  }, [ctx, invoices]);

  const paymentStatus = useMemo(() => deriveTenantPaymentStatus(invoices), [invoices]);

  const reload = async () => {
    if (!tenantId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantId) }),
      queryClient.invalidateQueries({ queryKey: ["tenant-statement", tenantId] }),
      workspaceId ? queryClient.invalidateQueries({ queryKey: queryKeys.profile(workspaceId) }) : Promise.resolve()
    ]);
  };

  return {
    ctx,
    summary,
    transactions,
    invoices,
    payments,
    loading,
    error,
    leaseStatus,
    paymentStatus,
    reload,
    tenantOverview: tenantPayload ?? null,
    overviewLoading: tenantQuery.isLoading && !tenantQuery.data
  };
}
