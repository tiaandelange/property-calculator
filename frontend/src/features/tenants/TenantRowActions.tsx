import { IconButton } from "../../components/icons";
import type { TenantListItem } from "./tenantDirectoryTypes";

export function TenantRowActions({ tenant }: { tenant: TenantListItem }) {
  const mailHref =
    tenant.email && tenant.email.trim()
      ? `mailto:${encodeURIComponent(tenant.email.trim())}`
      : undefined;

  return (
    <div className="pg-tenants-actions">
      <IconButton icon="view" aria-label={`View ${tenant.fullName}`} href={`/tenants/${tenant.id}`} variant="outline" />
      {mailHref ? (
        <IconButton icon="email" aria-label={`Email ${tenant.fullName}`} href={mailHref} variant="outline" />
      ) : (
        <IconButton icon="email" aria-label="No email on file" variant="outline" disabled />
      )}
      <IconButton
        icon="edit"
        aria-label={`Edit ${tenant.fullName}`}
        href={`/tenants/${tenant.id}/edit`}
        variant="outline"
      />
    </div>
  );
}
