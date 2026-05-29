import { Eye, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { fmtZar } from "../financials/propertyFinancialsAdapter";
import {
  linkStatusBadgeClass,
  TENANT_LINK_ROLE_OPTIONS,
  TENANT_LINK_STATUS_OPTIONS,
  vettingBadgeClass,
  vettingStatusFromTenant,
  type TenantUnitLinkRecord
} from "./tenantUnitLinkTypes";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tenantInitials(link: TenantUnitLinkRecord): string {
  const f = String(link.tenant?.firstName ?? "T").slice(0, 1).toUpperCase();
  const l = String(link.tenant?.lastName ?? "").slice(0, 1).toUpperCase();
  return `${f}${l}`;
}

function roleLabel(role: string): string {
  return TENANT_LINK_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function statusLabel(status: string): string {
  return TENANT_LINK_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function TenantUnitLinksTable({
  links,
  loading,
  isMobile,
  onEdit,
  onRemove
}: {
  links: TenantUnitLinkRecord[];
  loading?: boolean;
  isMobile?: boolean;
  onEdit: (link: TenantUnitLinkRecord) => void;
  onRemove: (link: TenantUnitLinkRecord) => void;
}) {
  if (loading) return <div className="pg-muted">Loading linked tenants…</div>;

  if (links.length === 0) {
    return (
      <div className="pg-pfin-empty">
        <p>No tenants linked to this unit yet.</p>
        <p className="pg-muted">Assign existing tenants without creating a lease automatically.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ul className="pg-pfin-expense-list">
        {links.map((link) => {
          const vetting = vettingStatusFromTenant(link.tenant?.status);
          return (
            <li key={link.id} className="pg-pfin-expense-list__item">
              <div className="pg-pfin-expense-list__main">
                <span className="pg-pfin-expense-icon" aria-hidden>
                  {tenantInitials(link)}
                </span>
                <div>
                  <div className="pg-pfin-expense-list__title">
                    {link.tenant?.firstName} {link.tenant?.lastName}
                    {link.isPrimary ? <span className="pg-pfin-badge pg-pfin-badge--primary" style={{ marginLeft: 8 }}>Primary</span> : null}
                  </div>
                  <div className="pg-muted" style={{ fontSize: 12 }}>{link.tenant?.email ?? "No email"}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <span className={vettingBadgeClass(vetting)}>{vetting}</span>
                    <span className={linkStatusBadgeClass(link.status)}>{statusLabel(link.status)}</span>
                  </div>
                </div>
              </div>
              <div className="pg-pfin-expense-list__right">
                <div className="pg-pfin-row-actions">
                  <Link to={`/tenants/${link.tenantId}`} className="pg-pfin-icon-btn" aria-label="View tenant">
                    <Eye size={16} />
                  </Link>
                  <button type="button" className="pg-pfin-icon-btn" aria-label="Edit link" onClick={() => onEdit(link)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="pg-pfin-icon-btn pg-pfin-icon-btn--danger"
                    aria-label="Remove link"
                    onClick={() => onRemove(link)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="pg-pfin-table-wrap">
      <table className="pg-pfin-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Role</th>
            <th>Vetting Status</th>
            <th>Link Status</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Lease</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const vetting = vettingStatusFromTenant(link.tenant?.status);
            const leaseLabel = link.lease
              ? `${link.lease.displayStatus ?? link.lease.status}${link.lease.monthlyRent != null ? ` · ${fmtZar(link.lease.monthlyRent)}` : ""}`
              : "No lease yet";
            return (
              <tr key={link.id}>
                <td>
                  <div className="pg-pfin-expense-name">
                    <span className="pg-pfin-expense-icon" aria-hidden>
                      {tenantInitials(link)}
                    </span>
                    <div>
                      <div>
                        {link.tenant?.firstName} {link.tenant?.lastName}
                        {link.isPrimary ? (
                          <span className="pg-pfin-badge pg-pfin-badge--primary" style={{ marginLeft: 8 }}>
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <div className="pg-muted" style={{ fontSize: 12 }}>
                        {link.tenant?.email ?? "No email"}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{roleLabel(link.role)}</td>
                <td>
                  <span className={vettingBadgeClass(vetting)}>{vetting}</span>
                </td>
                <td>
                  <span className={linkStatusBadgeClass(link.status)}>{statusLabel(link.status)}</span>
                </td>
                <td>{formatDate(link.startDate)}</td>
                <td>{formatDate(link.endDate)}</td>
                <td className="pg-muted">{leaseLabel}</td>
                <td>
                  <div className="pg-pfin-row-actions">
                    <Link to={`/tenants/${link.tenantId}`} className="pg-pfin-icon-btn" aria-label="View tenant">
                      <Eye size={16} />
                    </Link>
                    <button type="button" className="pg-pfin-icon-btn" aria-label="Edit link" onClick={() => onEdit(link)}>
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="pg-pfin-icon-btn pg-pfin-icon-btn--danger"
                      aria-label="Remove link"
                      onClick={() => onRemove(link)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function UnitTenantLinksSection({
  unitName,
  unitDescription,
  occupancyLabel,
  expectedRent,
  linkedCount,
  links,
  loading,
  isMobile,
  canLink,
  missingUnitId,
  onLinkTenant,
  onEdit,
  onRemove
}: {
  unitName: string;
  unitDescription?: string | null;
  occupancyLabel: string;
  expectedRent: number;
  linkedCount: number;
  links: TenantUnitLinkRecord[];
  loading?: boolean;
  isMobile?: boolean;
  canLink: boolean;
  missingUnitId?: boolean;
  onLinkTenant: () => void;
  onEdit: (link: TenantUnitLinkRecord) => void;
  onRemove: (link: TenantUnitLinkRecord) => void;
}) {
  return (
    <section className="pg-pfin-section pg-pfin-unit-card">
      <header className="pg-pfin-unit-card__head">
        <div>
          <h3 className="pg-pfin-unit-card__title">{unitName}</h3>
          {unitDescription ? <p className="pg-pfin-section__desc">{unitDescription}</p> : null}
          <div className="pg-pfin-unit-card__meta">
            <span className="pg-pfin-badge pg-pfin-badge--info">{occupancyLabel}</span>
            {expectedRent > 0 ? (
              <span className="pg-muted">
                Expected rent: <strong>{fmtZar(expectedRent)}</strong>/mo
              </span>
            ) : null}
            <span className="pg-muted">
              {linkedCount} linked tenant{linkedCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {canLink ? (
          <button type="button" className="pg-btn pg-btn-primary pg-pfin-add-btn" onClick={onLinkTenant}>
            <Plus size={18} aria-hidden />
            Link Tenant
          </button>
        ) : null}
      </header>

      {missingUnitId ? (
        <div className="pg-alert" role="alert">
          Save this property&apos;s unit structure before linking tenants to this unit.
        </div>
      ) : null}

      <TenantUnitLinksTable links={links} loading={loading} isMobile={isMobile} onEdit={onEdit} onRemove={onRemove} />

      {canLink && links.length === 0 && !loading && !missingUnitId ? (
        <button type="button" className="pg-btn pg-btn-secondary" style={{ marginTop: 10, width: isMobile ? "100%" : undefined }} onClick={onLinkTenant}>
          <UserPlus size={16} aria-hidden style={{ marginRight: 6 }} />
          Link Tenant
        </button>
      ) : null}
    </section>
  );
}
