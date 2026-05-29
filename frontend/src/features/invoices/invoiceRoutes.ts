/** Single invoice editor route used by property and tenant statements. */
export function tenantInvoiceEditorPath(
  tenantId: string,
  invoiceId: string,
  propertyId?: string | null
): string {
  const base = `/tenants/${tenantId}/invoices/${invoiceId}`;
  if (propertyId && String(propertyId).trim()) {
    return `${base}?propertyId=${encodeURIComponent(String(propertyId))}`;
  }
  return base;
}
