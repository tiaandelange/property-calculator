import type { TenantListItem } from "./tenantDirectoryTypes";
import { tenantRowContactEmail } from "./tenantDirectoryUtils";
import { ProplyticTableRowActionsMenu } from "../../components/tables";

export function TenantRowActions({
  tenant,
  onDelete
}: {
  tenant: TenantListItem;
  onDelete?: (tenant: TenantListItem) => void;
}) {
  const email = tenantRowContactEmail(tenant);
  const mailHref = email ? `mailto:${encodeURIComponent(email)}` : undefined;

  return (
    <ProplyticTableRowActionsMenu
      actions={[
        {
          key: "edit",
          label: "Edit tenant",
          icon: "edit",
          href: `/tenants/${tenant.id}/edit`,
          primary: true
        },
        {
          key: "view",
          label: "View tenant",
          icon: "view",
          href: `/tenants/${tenant.id}`
        },
        {
          key: "email",
          label: mailHref ? "Email tenant" : "No email on file",
          icon: "email",
          href: mailHref,
          disabled: !mailHref
        },
        {
          key: "delete",
          label: "Delete tenant",
          menuLabel: "Delete permanently",
          icon: "delete",
          onClick: onDelete ? () => onDelete(tenant) : undefined,
          disabled: !onDelete,
          destructive: true
        }
      ]}
    />
  );
}
