/** Canonical invoice detail/edit route — use for all View/Edit navigation. */
export function invoiceDetailPath(invoiceId: string): string {
  return `/invoices/${invoiceId}`;
}

/** Create-invoice entry (requires tenantId + propertyId query params). */
export function invoiceCreatePath(opts: { tenantId: string; propertyId: string; leaseId?: string | null }): string {
  const params = new URLSearchParams({
    tenantId: opts.tenantId,
    propertyId: opts.propertyId
  });
  if (opts.leaseId) params.set("leaseId", opts.leaseId);
  return `/invoices/new?${params.toString()}`;
}

/** Property statement tab for an invoice's property. */
export function invoiceStatementPath(propertyId: string): string {
  return `/owned-properties/${propertyId}?tab=statement`;
}

/** @deprecated Use {@link invoiceDetailPath} — tenant-scoped route redirects to /invoices/:id. */
export function tenantInvoiceEditorPath(
  _tenantId: string,
  invoiceId: string,
  _propertyId?: string | null
): string {
  return invoiceDetailPath(invoiceId);
}
