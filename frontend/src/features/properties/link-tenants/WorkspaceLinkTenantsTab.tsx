import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import {
  createTenantUnitLink,
  listTenantUnitLinksForProperty,
  removeTenantUnitLink,
  updateTenantUnitLink
} from "../../../services/tenantUnitLinksSupabase";
import { listPropertyUnits } from "../../../services/propertyUnitsSupabase";
import { getTenantsEligibleForProperty, propertyApiErrorMessage } from "../../../api/ownedProperties";
import { fmtZar } from "../financials/propertyFinancialsAdapter";
import { getPropertyTypeConfig } from "../../../config/propertyTypes";
import type { PropertyUnitDraft } from "../units/propertyUnitTypes";
import { LinkTenantToUnitModal, type LinkTenantFormState } from "./LinkTenantToUnitModal";
import { EditTenantUnitLinkModal } from "./EditTenantUnitLinkModal";
import { UnitTenantLinksSection } from "./TenantUnitLinksTable";
import type { TenantUnitLinkRecord } from "./tenantUnitLinkTypes";
import {
  activeLinksForUnit,
  displayUnitsForLinking,
  isSingleUnitProperty,
  shouldShowTenantLinking,
  structureTypeIdFromPropertyRow,
  sumExpectedRentForUnits,
  unitExpectedRentDisplay,
  unitOccupancyLabel
} from "./unitTenantLinkUtils";

export function WorkspaceLinkTenantsTab({
  propertyId,
  property,
  onRefresh
}: {
  propertyId: string;
  property: Record<string, unknown>;
  onRefresh?: () => void | Promise<void>;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [units, setUnits] = useState<PropertyUnitDraft[]>([]);
  const [links, setLinks] = useState<TenantUnitLinkRecord[]>([]);
  const [eligibleTenants, setEligibleTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkModal, setLinkModal] = useState<{ unitId: string | null; unitName: string } | null>(null);
  const [editLink, setEditLink] = useState<TenantUnitLinkRecord | null>(null);

  const structureTypeId = structureTypeIdFromPropertyRow(property);
  const structureCfg = getPropertyTypeConfig(structureTypeId);
  const showLinking = shouldShowTenantLinking(property, units);
  const isStr = String(property.investmentType ?? "").toUpperCase() === "SHORT_TERM_RENTAL";
  const isLandNoUnits = !showLinking && String(property.investmentType ?? "").toUpperCase() === "VACANT_LAND";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [unitRows, linkRows, tenants] = await Promise.all([
        listPropertyUnits(propertyId),
        listTenantUnitLinksForProperty(propertyId),
        getTenantsEligibleForProperty(propertyId)
      ]);
      setUnits(unitRows);
      setLinks(linkRows);
      setEligibleTenants(Array.isArray(tenants) ? tenants : []);
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
  const totalExpectedRent = sumExpectedRentForUnits(displayUnits);

  const onCreateLink = async (form: LinkTenantFormState) => {
    if (!linkModal) return;
    setSaving(true);
    setError("");
    try {
      await createTenantUnitLink({
        propertyId,
        unitId: linkModal.unitId,
        tenantId: form.tenantId,
        role: form.isPrimary ? "primary_tenant" : form.role,
        status: form.status,
        isPrimary: form.isPrimary,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes || null
      });
      setLinkModal(null);
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(propertyApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async (patch: {
    role: import("./tenantUnitLinkTypes").TenantLinkRole;
    status: import("./tenantUnitLinkTypes").TenantLinkStatus;
    isPrimary: boolean;
    startDate: string;
    endDate: string;
    notes: string;
  }) => {
    if (!editLink) return;
    setSaving(true);
    setError("");
    try {
      await updateTenantUnitLink(editLink.id, {
        role: patch.role,
        status: patch.status,
        isPrimary: patch.isPrimary,
        startDate: patch.startDate || null,
        endDate: patch.endDate || null,
        notes: patch.notes || null
      });
      setEditLink(null);
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(propertyApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (link: TenantUnitLinkRecord) => {
    if (!window.confirm(`Remove link for ${link.tenant?.firstName ?? "tenant"} ${link.tenant?.lastName ?? ""}?`)) return;
    setError("");
    try {
      await removeTenantUnitLink(link.id);
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(propertyApiErrorMessage(e));
    }
  };

  if (isStr) {
    return (
      <div className="pg-pfin-page">
        <section className="pg-pfin-section">
          <header className="pg-pfin-section__head">
            <div>
              <h2 className="pg-pfin-section__title">Tenant links not used for short-term rentals</h2>
              <p className="pg-pfin-section__desc">
                This property type uses occupancy, bookings and short-term rental costs instead of tenant leases.
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
            <h2 className="pg-pfin-section__title">Link Tenants</h2>
            <p className="pg-pfin-section__desc">Assign existing tenants to units without creating leases automatically.</p>
            {totalExpectedRent > 0 ? (
              <p className="pg-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
                Total expected rent (per unit, not per tenant): <strong>{fmtZar(totalExpectedRent)}</strong>/mo
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="pg-btn pg-btn-ghost" to="/tenants/new">
              <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
              Create Tenant
            </Link>
            <Link className="pg-btn pg-btn-ghost" to="/tenants">
              Tenant Directory
            </Link>
          </div>
        </header>
      </section>

      {error ? (
        <div className="pg-alert pg-alert-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? <div className="pg-muted">Loading units and tenant links…</div> : null}

      {!loading && displayUnits.length === 0 ? (
        <section className="pg-pfin-section">
          <div className="pg-pfin-empty">
            <p>No units found for this property.</p>
            <p className="pg-muted">Add units in Property Structure before linking tenants.</p>
            <Link className="pg-btn pg-btn-secondary" to={`/owned-properties/${propertyId}/edit`}>
              Edit Property Structure
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && displayUnits.length > 0
        ? displayUnits.map((unit, index) => {
            const unitId = unit.id ?? null;
            const unitLinks = links.filter((l) => (l.unitId ?? null) === (unitId ?? null));
            const title =
              singleUnit && displayUnits.length === 1
                ? unit.unitName || structureCfg.unitLabel || String(property.name ?? "Main House")
                : unit.unitName || `${structureCfg.unitLabel} ${index + 1}`;
            return (
              <UnitTenantLinksSection
                key={unit.id ?? unit.clientId}
                unitName={title}
                unitDescription={unit.description}
                occupancyLabel={unitOccupancyLabel(links, unitId, unit)}
                expectedRent={unitExpectedRentDisplay(unit)}
                linkedCount={activeLinksForUnit(links, unitId).length}
                links={unitLinks}
                loading={false}
                isMobile={isMobile}
                canLink={Boolean(unitId)}
                missingUnitId={!unitId}
                onLinkTenant={() => setLinkModal({ unitId, unitName: title })}
                onEdit={(l) => setEditLink(l)}
                onRemove={(l) => void onRemove(l)}
              />
            );
          })
        : null}

      <LinkTenantToUnitModal
        open={linkModal != null}
        unitName={linkModal?.unitName ?? ""}
        propertyId={propertyId}
        unitId={linkModal?.unitId ?? null}
        tenants={eligibleTenants}
        existingLinks={links.filter((l) => (l.unitId ?? null) === (linkModal?.unitId ?? null))}
        saving={saving}
        onClose={() => setLinkModal(null)}
        onSubmit={onCreateLink}
      />

      <EditTenantUnitLinkModal open={editLink != null} link={editLink} saving={saving} onClose={() => setEditLink(null)} onSubmit={onSaveEdit} />
    </div>
  );
}
