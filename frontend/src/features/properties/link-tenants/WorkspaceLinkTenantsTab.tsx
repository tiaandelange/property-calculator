import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink } from "../../../components/ui/Button";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { listActiveLeaseOccupancyForProperty, type ActiveLeaseOccupancy } from "../../../services/leasesSupabase";
import { listPropertyUnits } from "../../../services/propertyUnitsSupabase";
import { propertyApiErrorMessage } from "../../../api/ownedProperties";
import { fmtZar } from "../financials/propertyFinancialsAdapter";
import {
  ProplyticAmountCell,
  ProplyticMobileRowCard,
  ProplyticMobileRowList,
  ProplyticStatusBadge,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableWrap
} from "../../../components/tables";
import { getPropertyTypeConfig } from "../../../config/propertyTypes";
import type { PropertyUnitDraft } from "../units/propertyUnitTypes";
import {
  displayUnitsForLinking,
  isSingleUnitProperty,
  shouldShowTenantLinking,
  structureTypeIdFromPropertyRow,
  unitDisplayLabel
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
      <ProplyticTableEmptyState
        title="No tenants linked through active leases for this unit"
        description="Create a lease to connect tenants to this property and unit."
      />
    );
  }

  if (isMobile) {
    return (
      <ProplyticMobileRowList>
        {occupancy.flatMap((lease) =>
          lease.tenants.map((t) => (
            <li key={`${lease.leaseId}-${t.tenantId}`}>
              <ProplyticMobileRowCard
                title={
                  <Link className="pg-link" to={`/tenants/${t.tenantId}`}>
                    {t.firstName} {t.lastName}
                  </Link>
                }
                badge={t.isPrimary ? <ProplyticStatusBadge status="primary_tenant" label="Primary" /> : undefined}
                fields={[
                  { label: "Role", value: roleLabel(t.role) },
                  { label: "Lease", value: lease.displayStatus },
                  {
                    label: "Rent",
                    value: `${t.rentShareAmount != null ? fmtZar(t.rentShareAmount) : fmtZar(lease.monthlyRent)}/mo`
                  }
                ]}
              />
            </li>
          ))
        )}
      </ProplyticMobileRowList>
    );
  }

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable>
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="text">Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference">Role</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status">Lease</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Rent</ProplyticTableHeadCell>
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {occupancy.flatMap((lease) =>
            lease.tenants.map((t) => (
              <ProplyticTableRow key={`${lease.leaseId}-${t.tenantId}`}>
                <ProplyticTableCell columnType="text">
                  <Link className="pg-link" to={`/tenants/${t.tenantId}`}>
                    {t.firstName} {t.lastName}
                  </Link>
                  {t.isPrimary ? (
                    <span style={{ marginLeft: 8 }}>
                      <ProplyticStatusBadge status="primary_tenant" label="Primary" />
                    </span>
                  ) : null}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="reference">{roleLabel(t.role)}</ProplyticTableCell>
                <ProplyticTableCell columnType="status">
                  <ProplyticStatusBadge status={lease.displayStatus} />
                  <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Lease #{lease.leaseId.slice(0, 8)}
                  </div>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  <ProplyticAmountCell>
                    {t.rentShareAmount != null ? fmtZar(t.rentShareAmount) : fmtZar(lease.monthlyRent)}/mo
                  </ProplyticAmountCell>
                  {lease.tenants.length > 1 && t.rentShareAmount != null ? (
                    <div className="pg-muted" style={{ fontSize: 11 }}>Split share</div>
                  ) : null}
                </ProplyticTableCell>
              </ProplyticTableRow>
            ))
          )}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
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
            <ButtonLink href={`/owned-properties/${propertyId}?tab=financials`} variant="soft">
              Go to Financials
            </ButtonLink>
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
              <h2 className="pg-pfin-section__title">Tenants</h2>
              <p className="pg-pfin-section__desc">No tenant links are required for this property type.</p>
            </div>
          </header>
        </section>
      </div>
    );
  }

  return (
    <div className="pg-pfin-page">
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
            <ButtonLink href={`/owned-properties/${propertyId}/edit`} variant="soft">
              Edit Property Structure
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {!loading && displayUnits.length > 0
        ? displayUnits.map((unit, index) => {
            const unitId = unit.id ?? null;
            const unitOcc = occupancyByUnit.get(unitId) ?? occupancyByUnit.get(null) ?? [];
            const title =
              singleUnit && displayUnits.length === 1
                ? unitDisplayLabel(
                    unit,
                    structureCfg.unitLabel || String(property.name ?? "Main House")
                  )
                : unitDisplayLabel(unit, `${structureCfg.unitLabel} ${index + 1}`);
            return (
              <section key={unit.id ?? unit.clientId} className="pg-pfin-section">
                <header className="pg-pfin-section__head">
                  <div>
                    <h3 className="pg-pfin-section__title">{title}</h3>
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
            <ButtonLink href={`/leases/new?propertyId=${propertyId}`} variant="primary">
              Add Lease
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
