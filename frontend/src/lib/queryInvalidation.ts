import type { QueryClient } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";

type InvalidateOpts = {
  queryClient?: QueryClient;
  workspaceId?: string;
  propertyId?: string;
  tenantId?: string;
};

function client(opts?: InvalidateOpts): QueryClient {
  return opts?.queryClient ?? queryClient;
}

function ws(workspaceId?: string): string | undefined {
  return workspaceId;
}

function invalidateInvoiceDirectoryQueries(qc: QueryClient, wid: string) {
  void qc.invalidateQueries({ queryKey: ["invoice-metrics", wid] });
  void qc.invalidateQueries({ queryKey: queryKeys.invoicesList(wid) });
  void qc.invalidateQueries({ queryKey: queryKeys.invoicesDirectory(wid) });
}

/** Broad portfolio refresh — used by legacy invalidation event bridge. */
export function invalidatePortfolioQueries(opts?: InvalidateOpts) {
  const qc = client(opts);
  const wid = ws(opts?.workspaceId);
  const matchers: Array<{ queryKey: readonly unknown[] }> = [];

  if (wid) {
    matchers.push(
      { queryKey: ["properties", wid] },
      { queryKey: ["properties-directory", wid] },
      { queryKey: ["tenants-directory", wid] },
      { queryKey: ["leases-directory", wid] },
      { queryKey: ["tenants", wid] },
      { queryKey: ["leases", wid] },
      { queryKey: ["invoices", wid] },
      { queryKey: ["invoice-metrics", wid] },
      { queryKey: ["financials", wid] },
      { queryKey: ["dashboard-summary", wid] },
      { queryKey: queryKeys.reports(wid) }
    );
  } else {
    matchers.push(
      { queryKey: ["properties"] },
      { queryKey: ["tenants"] },
      { queryKey: ["leases"] },
      { queryKey: ["invoices"] },
      { queryKey: ["invoice-metrics"] },
      { queryKey: ["financials"] },
      { queryKey: ["dashboard-summary"] },
      { queryKey: ["reports"] }
    );
  }

  for (const m of matchers) {
    void qc.invalidateQueries(m);
  }

  if (opts?.propertyId) {
    invalidatePropertyQueries({ ...opts, propertyId: opts.propertyId });
  }
  if (opts?.tenantId) {
    invalidateTenantQueries({ ...opts, tenantId: opts.tenantId });
  }
}

export function invalidatePropertyQueries(opts: InvalidateOpts & { propertyId: string }) {
  const qc = client(opts);
  const wid = ws(opts.workspaceId);
  const pid = opts.propertyId;

  void qc.invalidateQueries({ queryKey: ["property", pid] });
  void qc.invalidateQueries({ queryKey: queryKeys.propertyUnits(pid) });
  void qc.invalidateQueries({ queryKey: queryKeys.propertyLeases(pid) });
  void qc.invalidateQueries({ queryKey: ["property-statement", pid] });
  void qc.invalidateQueries({ queryKey: ["property-statement-range", pid] });

  if (wid) {
    void qc.invalidateQueries({ queryKey: ["properties", wid] });
    void qc.invalidateQueries({ queryKey: queryKeys.propertiesDirectory(wid) });
    void qc.invalidateQueries({ queryKey: queryKeys.dashboardSummary(wid, { propertyId: pid }) });
    void qc.invalidateQueries({ queryKey: ["financials", wid] });
    void qc.invalidateQueries({ queryKey: queryKeys.propertiesDirectory(wid) });
    void qc.invalidateQueries({ queryKey: queryKeys.leasesDirectory(wid) });
    void qc.invalidateQueries({ queryKey: queryKeys.tenantsDirectory(wid) });
    invalidateInvoiceDirectoryQueries(qc, wid);
  } else {
    void qc.invalidateQueries({ queryKey: ["properties"] });
    void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    void qc.invalidateQueries({ queryKey: ["financials"] });
    void qc.invalidateQueries({ queryKey: ["leases"] });
    void qc.invalidateQueries({ queryKey: ["tenants"] });
    void qc.invalidateQueries({ queryKey: ["invoices"] });
  }
}

export function invalidateLeaseQueries(opts: InvalidateOpts & { propertyId: string; tenantId?: string }) {
  invalidatePropertyQueries(opts);
  const qc = client(opts);
  const wid = ws(opts.workspaceId);
  if (wid) {
    void qc.invalidateQueries({ queryKey: queryKeys.propertiesDirectory(wid) });
    void qc.invalidateQueries({ queryKey: queryKeys.leasesDirectory(wid) });
    void qc.invalidateQueries({ queryKey: queryKeys.tenantsDirectory(wid) });
    invalidateInvoiceDirectoryQueries(qc, wid);
  }
  if (opts.tenantId) {
    invalidateTenantQueries({ ...opts, tenantId: opts.tenantId });
  }
}

export function invalidateInvoiceQueries(
  opts: InvalidateOpts & { propertyId?: string; tenantId?: string; invoiceId?: string }
) {
  const qc = client(opts);
  const wid = ws(opts.workspaceId);
  if (opts.invoiceId) {
    void qc.invalidateQueries({ queryKey: queryKeys.invoiceDetail(opts.invoiceId) });
  }
  if (wid) {
    invalidateInvoiceDirectoryQueries(qc, wid);
    void qc.invalidateQueries({ queryKey: ["dashboard-summary", wid] });
    void qc.invalidateQueries({ queryKey: ["financials", wid] });
    invalidateWorkspaceNotifications({ ...opts, workspaceId: wid });
  } else {
    void qc.invalidateQueries({ queryKey: ["invoices"] });
    void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    void qc.invalidateQueries({ queryKey: ["financials"] });
  }
  if (opts.propertyId) {
    invalidatePropertyQueries({ ...opts, propertyId: opts.propertyId });
  }
  if (opts.tenantId) {
    invalidateTenantQueries({ ...opts, tenantId: opts.tenantId });
  }
}

export function invalidateWorkspaceNotifications(opts?: InvalidateOpts) {
  const qc = client(opts);
  const wid = ws(opts?.workspaceId);
  if (wid) {
    void qc.invalidateQueries({ queryKey: queryKeys.workspaceNotifications(wid) });
  } else {
    void qc.invalidateQueries({ queryKey: ["workspace-notifications"] });
  }
}

export function invalidatePaymentQueries(
  opts: InvalidateOpts & { propertyId?: string; tenantId?: string; invoiceId?: string }
) {
  invalidateInvoiceQueries(opts);
  invalidateWorkspaceNotifications(opts);
}

export function invalidateTenantQueries(opts: InvalidateOpts & { tenantId: string }) {
  const qc = client(opts);
  const wid = ws(opts.workspaceId);
  void qc.invalidateQueries({ queryKey: queryKeys.tenant(opts.tenantId) });
  void qc.invalidateQueries({ queryKey: ["tenant-statement", opts.tenantId] });
  if (wid) {
    void qc.invalidateQueries({ queryKey: queryKeys.tenantsDirectory(wid) });
    void qc.invalidateQueries({ queryKey: queryKeys.leasesDirectory(wid) });
  }
}

export function invalidateSettingsQueries(opts?: InvalidateOpts) {
  const qc = client(opts);
  const wid = ws(opts?.workspaceId);
  if (wid) {
    void qc.invalidateQueries({ queryKey: queryKeys.settings(wid) });
  } else {
    void qc.invalidateQueries({ queryKey: ["settings"] });
  }
}
