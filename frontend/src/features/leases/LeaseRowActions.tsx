import { Link } from "react-router-dom";
import { IconButton } from "../../components/icons";
import { propertyLeasesPath } from "./leaseRoutes";
import type { LeaseListItem } from "./leaseDirectoryTypes";

export function LeaseRowActions({
  lease,
  onCancel,
  onDelete
}: {
  lease: LeaseListItem;
  onCancel?: (leaseId: string) => void;
  onDelete?: (leaseId: string) => void;
}) {
  return (
    <div className="pg-leases-actions">
      <IconButton
        icon="property"
        aria-label={`View property ${lease.propertyName}`}
        href={`/owned-properties/${lease.propertyId}?tab=leases`}
        variant="outline"
      />
      {lease.tenantId ? (
        <IconButton
          icon="tenant"
          aria-label={`View tenant ${lease.tenantName}`}
          href={`/tenants/${lease.tenantId}`}
          variant="outline"
        />
      ) : (
        <IconButton icon="tenant" aria-label="No tenant linked" variant="outline" disabled />
      )}
      <IconButton
        icon="view"
        aria-label={`View lease for ${lease.tenantName} at ${lease.propertyName}`}
        href={propertyLeasesPath(lease.propertyId, lease.id)}
        variant="outline"
      />
      {lease.isCancellable && onCancel ? (
        <IconButton
          icon="leaseCancel"
          aria-label={`Cancel lease for ${lease.tenantName}`}
          variant="outline"
          onClick={() => onCancel(lease.id)}
        />
      ) : null}
      {onDelete ? (
        <IconButton
          icon="delete"
          aria-label={`Permanently delete lease for ${lease.tenantName}`}
          variant="danger"
          onClick={() => onDelete(lease.id)}
        />
      ) : null}
    </div>
  );
}
