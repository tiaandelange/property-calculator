import { Eye, Mail, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import type { TenantListItem } from "./tenantDirectoryTypes";

export function TenantRowActions({ tenant }: { tenant: TenantListItem }) {
  const mailHref =
    tenant.email && tenant.email.trim()
      ? `mailto:${encodeURIComponent(tenant.email.trim())}`
      : undefined;

  return (
    <div className="pg-tenants-actions">
      <Link
        to={`/tenants/${tenant.id}`}
        className="pg-tenants-action-btn"
        aria-label={`View ${tenant.fullName}`}
      >
        <Eye size={16} aria-hidden />
      </Link>
      {mailHref ? (
        <a href={mailHref} className="pg-tenants-action-btn" aria-label={`Email ${tenant.fullName}`}>
          <Mail size={16} aria-hidden />
        </a>
      ) : (
        <button type="button" className="pg-tenants-action-btn" disabled aria-label="No email on file">
          <Mail size={16} aria-hidden />
        </button>
      )}
      <Link
        to={`/tenants/${tenant.id}/edit`}
        className="pg-tenants-action-btn"
        aria-label={`Edit ${tenant.fullName}`}
      >
        <Pencil size={16} aria-hidden />
      </Link>
    </div>
  );
}
