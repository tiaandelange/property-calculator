import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { listActiveLeaseOccupancyForProperty, type ActiveLeaseOccupancy } from "../../../services/leasesSupabase";
import { listPropertyUnits } from "../../../services/propertyUnitsSupabase";
import { propertyApiErrorMessage } from "../../../api/ownedProperties";
import { fmtZar } from "../financials/propertyFinancialsAdapter";
import { getPropertyTypeConfig } from "../../../config/propertyTypes";
import type { PropertyUnitDraft } from "../units/propertyUnitTypes";
import {
  displayUnitsForLinking,
  isSingleUnitProperty,
  shouldShowTenantLinking,
  structureTypeIdFromPropertyRow
} from "./unitTenantLinkUtils";

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function LeaseOccupancyTable({
  occupancy,
  isMobile
}: {
  occupancy: ActiveLeaseOccupancy[];
  isMobile?: boolean;
}) {
  if (!occupancy.length) {
    return (
      <div className="pg-pfin-empty">
        <p>No tenants linked through active leases for this unit.</p>
        <p className="pg-muted">Create a lease to connect tenants to this property and unit.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ul className="pg-pfin-expense-list">
        {occupancy.flatMap((lease) =>
          lease.tenants.map((t) => (
            <li key={`${lease.leaseId}-${t.tenantId}`} className="pg-pfin-expense-list__item">
              <div className="pg-pfin-expense-list__main">
                <div>
                  <div className="pg-pfin-expense-list__title">
                    <Link className="pg-link" to={`/tenants/${t.tenantId}`}>
                      {t.firstName} {t.lastName}
                    </Link>
                    {t.isPrimary ? (
                      <span className="pg-pfin-badge pg-pfin-badge--primary" style={{ marginLeft: 8 }}>
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <div className="pg-muted" style={{ fontSize: 12 }}>
                    {roleLabel(t.role)} · {lease.displayStatus} · {fmtZar(lease.monthlyRent)}/mo
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
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
            <th>Lease</th>
            <th>Rent</th>
          </tr>
        </thead>
        <tbody>
          {occupancy.flatMap((lease) =>
            lease.tenants.map((t) => (
              <tr key={`${lease.leaseId}-${t.tenantId}`}>
                <td>
                  <Link className="pg-link" to={`/tenants/${t.tenantId}`}>
                    {t.firstName} {t.lastName}
                  </Link>
                  {t.isPrimary ? (
                    <span className="pg-pfin-badge pg-pfin-badge--primary" style={{ marginLeft: 8 }}>
                      Primary
                    </span>
                  ) : null}
                </td>
                <td>{roleLabel(t.role)}</td>
                <td>
                  <span className="pg-muted">{lease.displayStatus}</span>
                  <div className="pg-muted" style={{ fontSize: 12 }}>
                    Lease #{lease.leaseId.slice(0, 8)}
                  </div>
                </td>
                <td>{fmtZar(lease.monthlyRent)}/mo</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function WorkspaceLinkTenantsTab({
  propertyId,
  property
}: {
  propertyId: string;
  property: Record<string, unknown>;
  onRefresh?: () => void | Promise<void>;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [units, setUnits] = useState<PropertyUnitDraft[]>([]);
  const [occupancy, setOccupancy] = useState<ActiveLeaseOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const structureTypeId = structureTypeIdFromPropertyRow(property);
  const structureCfg = getPropertyTypeConfig(structureTypeId);
  const showLinking = shouldShowTenantLinking(property, units);
  const isStr = String(property.investmentType ?? "").toUpperCase() === "SHORT_TERM_RENTAL";
  const isLandNoUnits = !showLinking && String(property.investmentType ?? "").toUpperCase() === "VACANT_LAND";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [unitRows, occRows] = await Promise.all([
        listPropertyUnits(propertyId),
        listActiveLeaseOccupancyForProperty(propertyId)
      ]);
      setUnits(unitRows);
      setOccupancy(occRows);
    } catch (e) {
      setError(propertyApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayUnits = useMemo(() => displayUnitsForLinking(structureTypeId, units), [structureTypeId, units]);
  const singleUnit = isSingleUnitProperty(structureTypeId, displayUnits);

  const occupancyByUnit = useMemo(() => {
    const map = new Map<string | null, ActiveLeaseOccupancy[]>();
    for (const row of occupancy) {
      const key = row.unitId;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [occupancy]);

  if (isStr) {
    return (
      <div className="pg-pfin-page">
        <section className="pg-pfin-section">
          <header className="pg-pfin-section__head">
            <div>
              <h2 className="pg-pfin-section__title">Bookings and occupancy</h2>
              <p className="pg-pfin-section__desc">
                This property type uses bookings and occupancy instead of leases and tenant links.
              </p>
            </div>
          </header>
          <div className="pg-pfin-empty">
            <p>Use Financials to manage short-term rental income and costs.</p>
            <Link className="pg-btn pg-btn-secondary" to={`/owned-properties/${propertyId}?tab=financials`}>
              Go to Financials
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (isLandNoUnits) {
    return (
      <div className="pg-pfin-page">
        <section className="pg-pfin-section">
          <header className="pg-pfin-section__head">
            <div>
              <h2 className="pg-pfin-section__title">Link Tenants</h2>
              <p className="pg-pfin-section__desc">No tenant links are required for this property type.</p>
            </div>
          </header>
        </section>
      </div>
    );
  }

  return (
    <div className="pg-pfin-page">
      <section className="pg-pfin-section">
        <header className="pg-pfin-section__head pg-pfin-section__head--row">
          <div>
            <h2 className="pg-pfin-section__title">Tenants linked through active leases</h2>
            <p className="pg-pfin-section__desc">
              Occupancy is derived from active leases. Create a lease to connect tenants to a property and unit.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="pg-btn pg-btn-primary" to={`/leases/new?propertyId=${propertyId}`}>
              <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
              Create Lease
            </Link>
            <Link className="pg-btn pg-btn-ghost" to="/tenants/new">
              Create Tenant
            </Link>
          </div>
        </header>
      </section>

      {error ? (
        <div className="pg-alert pg-alert-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? <div className="pg-muted">Loading lease tenants…</div> : null}

      {!loading && displayUnits.length === 0 ? (
        <section className="pg-pfin-section">
          <div className="pg-pfin-empty">
            <p>No units found for this property.</p>
            <p className="pg-muted">Add units in Property Structure before creating leases.</p>
            <Link className="pg-btn pg-btn-secondary" to={`/owned-properties/${propertyId}/edit`}>
              Edit Property Structure
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && displayUnits.length > 0
        ? displayUnits.map((unit, index) => {
            const unitId = unit.id ?? null;
            const unitOcc = occupancyByUnit.get(unitId) ?? occupancyByUnit.get(null) ?? [];
            const title =
              singleUnit && displayUnits.length === 1
                ? unit.unitName || structureCfg.unitLabel || String(property.name ?? "Main House")
                : unit.unitName || `${structureCfg.unitLabel} ${index + 1}`;
            return (
              <section key={unit.id ?? unit.clientId} className="pg-pfin-section">
                <header className="pg-pfin-section__head">
                  <div>
                    <h3 className="pg-pfin-section__title">{title}</h3>
                    {unit.description ? <p className="pg-pfin-section__desc">{unit.description}</p> : null}
                  </div>
                </header>
                <LeaseOccupancyTable occupancy={unitOcc} isMobile={isMobile} />
              </section>
            );
          })
        : null}

      {!loading && occupancy.length === 0 && displayUnits.length > 0 ? (
        <section className="pg-pfin-section">
          <div className="pg-pfin-empty">
            <p>No active leases on this property yet.</p>
            <Link className="pg-btn pg-btn-primary" to={`/leases/new?propertyId=${propertyId}`}>
              Create Lease
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
