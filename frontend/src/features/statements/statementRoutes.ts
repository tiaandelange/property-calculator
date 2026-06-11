import type { TenantStatementDocumentType } from "./statementTypes";

export function statementDetailPath(statementId: string): string {
  return `/statements/${statementId}`;
}

export function statementCreatePath(opts: {
  type: TenantStatementDocumentType;
  tenantId: string;
  propertyId: string;
  leaseId?: string | null;
}): string {
  const params = new URLSearchParams({
    type: opts.type.toLowerCase(),
    tenantId: opts.tenantId,
    propertyId: opts.propertyId
  });
  if (opts.leaseId) params.set("leaseId", opts.leaseId);
  return `/statements/new?${params.toString()}`;
}
