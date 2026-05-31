import { ProplyticTableRowActionsMenu, type ProplyticTableRowAction } from "../../../components/tables";

export function PropertyLeaseRowActions({
  leaseId,
  tenantId,
  showEdit = true,
  showCancel = false,
  showDelete = true,
  canGenerateInvoice = false,
  onEdit,
  onCancel,
  onDelete,
  onGenerateInvoice
}: {
  leaseId: string;
  tenantId?: string | number | null;
  showEdit?: boolean;
  showCancel?: boolean;
  showDelete?: boolean;
  canGenerateInvoice?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onGenerateInvoice?: () => void;
}) {
  const actions: ProplyticTableRowAction[] = [];

  if (showEdit && onEdit) {
    actions.push({
      key: "edit",
      label: "Edit lease",
      icon: "edit",
      href: `/leases/${leaseId}/edit`,
      primary: true
    });
  }

  if (tenantId) {
    actions.push({
      key: "tenant",
      label: "View tenant",
      icon: "tenant",
      href: `/tenants/${tenantId}`
    });
  }

  if (onGenerateInvoice) {
    actions.push({
      key: "invoice",
      label: canGenerateInvoice ? "Generate invoice" : "Generate invoice (active lease only)",
      icon: "invoices",
      onClick: () => onGenerateInvoice(),
      disabled: !canGenerateInvoice
    });
  }

  if (showCancel && onCancel) {
    actions.push({
      key: "cancel",
      label: "Cancel lease",
      icon: "leaseCancel",
      onClick: () => onCancel(),
      destructive: true
    });
  }

  if (showDelete && onDelete) {
    actions.push({
      key: "delete",
      label: "Delete lease",
      icon: "delete",
      onClick: () => onDelete(),
      destructive: true
    });
  }

  if (!actions.length) return null;

  return <ProplyticTableRowActionsMenu actions={actions} />;
}
