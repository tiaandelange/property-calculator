import { useCallback, useEffect, useMemo, useState } from "react";
import { getTenant } from "../../../api/ownedProperties";
import { fetchMe } from "../../../api/user";
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

export function useTenantWorkspaceData(tenantId: string | undefined, periodKey: TenantStatementPeriodKey) {
  const [ctx, setCtx] = useState<TenantWorkspaceContext | null>(null);
  const [summary, setSummary] = useState<TenantStatementSummary | null>(null);
  const [transactions, setTransactions] = useState<TenantLedgerTransaction[]>([]);
  const [invoices, setInvoices] = useState<TenantInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaseStatus, setLeaseStatus] = useState("inactive");
  const [paymentStatus, setPaymentStatus] = useState("pending");

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [{ tenant, currentLease }, me] = await Promise.all([getTenant(tenantId), fetchMe()]);
      const property = (tenant.property ?? null) as Record<string, unknown> | null;
      const propertyId = property?.id != null ? String(property.id) : tenant.propertyId != null ? String(tenant.propertyId) : "";
      if (!propertyId) {
        setError("This tenant is not linked to a property. Link a property to view financials.");
        setCtx(null);
        setSummary(null);
        setTransactions([]);
        setInvoices([]);
        return;
      }

      const leases = (tenant.leases ?? []) as Record<string, unknown>[];
      const tenantLeaseIds = leases.map((l) => String(l.id)).filter(Boolean);
      if (currentLease?.id) {
        const lid = String(currentLease.id);
        if (!tenantLeaseIds.includes(lid)) tenantLeaseIds.push(lid);
      }

      const propertyName = property?.name != null ? String(property.name) : "Property";
      const unitRaw = property?.unitLabel ?? property?.unitNumber ?? property?.unit;
      const unitLabel = unitRaw ? `${String(unitRaw)}, ${propertyName}` : propertyName;

      /** Income rows on the property statement are not tenant-scoped in the API; omit unless one lease. */
      const singleTenantProperty = tenantLeaseIds.length <= 1;

      const bundle = await loadTenantFinancialBundle({
        propertyId,
        tenantId,
        tenantLeaseIds,
        periodKey,
        leaseStartDate: currentLease?.startDate != null ? String(currentLease.startDate) : null,
        singleTenantProperty
      });

      const tenantName = `${String(tenant.firstName ?? "").trim()} ${String(tenant.lastName ?? "").trim()}`.trim() || "Tenant";
      const lStatus = deriveTenantLeaseStatusFromData(currentLease, bundle.invoices);
      const pStatus = deriveTenantPaymentStatus(bundle.invoices);
      setLeaseStatus(lStatus);
      setPaymentStatus(pStatus);

      const rentDueDay =
        currentLease?.rentDueDay != null && Number.isFinite(Number(currentLease.rentDueDay))
          ? Number(currentLease.rentDueDay)
          : null;

      const built = buildTenantStatementSummary({
        tenantId,
        tenantName,
        propertyId,
        propertyName,
        unitName: unitLabel,
        tenantStatus: String(tenant.status ?? ""),
        period: bundle.period,
        transactions: bundle.transactions,
        invoices: bundle.invoices,
        rentDueDay
      });

      setCtx({
        tenantId,
        tenant,
        currentLease,
        propertyId,
        propertyName,
        unitLabel,
        tenantLeaseIds,
        singleTenantProperty,
        rentDueDay,
        profileName: String(me.name ?? me.email ?? "Proplytic"),
        invoicePaymentDetails: me.invoicePaymentDetails ?? null
      });
      setSummary(built);
      setTransactions(bundle.transactions);
      setInvoices(bundle.invoices);
    } catch (e: unknown) {
      console.error("[TenantWorkspace] load failed", e);
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : "Failed to load tenant statement.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId, periodKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const paidInvoices = useMemo(
    () => invoices.filter((i) => String(i.status).toUpperCase() === "PAID"),
    [invoices]
  );

  return {
    ctx,
    summary,
    transactions,
    invoices,
    paidInvoices,
    loading,
    error,
    leaseStatus,
    paymentStatus,
    reload
  };
}
