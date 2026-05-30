import { propertyLeasesPath } from "./leaseRoutes";
import type { LeaseListItem } from "./leaseDirectoryTypes";
import { ProplyticTableRowActionsMenu, type ProplyticTableRowAction } from "../../components/tables";

export function LeaseRowActions({
  lease,
  onCancel,
  onDelete
}: {
  lease: LeaseListItem;
  onCancel?: (leaseId: string) => void;
  onDelete?: (leaseId: string) => void;
}) {
  const actions: ProplyticTableRowAction[] = [
    {
      key: "edit",
      label: `Edit lease for ${lease.tenantName}`,
      icon: "edit",
      href: `/leases/${lease.id}/edit`,
      primary: true
    },
    {
      key: "property",
      label: `View property ${lease.propertyName}`,
      icon: "property",
      href: `/owned-properties/${lease.propertyId}?tab=leases`
    },
    {
      key: "tenant",
      label: lease.tenantId ? `View tenant ${lease.tenantName}` : "No tenant linked",
      icon: "tenant",
      href: lease.tenantId ? `/tenants/${lease.tenantId}` : undefined,
      disabled: !lease.tenantId
    },
    {
      key: "view",
      label: `View lease for ${lease.tenantName}`,
      icon: "view",
      href: propertyLeasesPath(lease.propertyId, lease.id)
    }
  ];

  if (lease.isCancellable && onCancel) {
    actions.push({
      key: "cancel",
      label: `Cancel lease for ${lease.tenantName}`,
      icon: "leaseCancel",
      onClick: () => onCancel(lease.id)
    });
  }

  if (onDelete) {
    actions.push({
      key: "delete",
      label: `Permanently delete lease for ${lease.tenantName}`,
      icon: "delete",
      onClick: () => onDelete(lease.id),
      destructive: true
    });
  }

  return <ProplyticTableRowActionsMenu actions={actions} />;
}
