import type { TenantListItem } from "./tenantDirectoryTypes";
import { ProplyticTableRowActionsMenu } from "../../components/tables";

export function TenantRowActions({ tenant }: { tenant: TenantListItem }) {
  const mailHref =
    tenant.email && tenant.email.trim()
      ? `mailto:${encodeURIComponent(tenant.email.trim())}`
      : undefined;

  return (
    <ProplyticTableRowActionsMenu
      actions={[
        {
          key: "edit",
          label: `Edit ${tenant.fullName}`,
          icon: "edit",
          href: `/tenants/${tenant.id}/edit`,
          primary: true
        },
        {
          key: "view",
          label: `View ${tenant.fullName}`,
          icon: "view",
          href: `/tenants/${tenant.id}`
        },
        {
          key: "email",
          label: mailHref ? `Email ${tenant.fullName}` : "No email on file",
          icon: "email",
          href: mailHref,
          disabled: !mailHref
        }
      ]}
    />
  );
}
