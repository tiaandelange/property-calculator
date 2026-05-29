import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ModalOverlay, ModalPanel } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import {
  TENANT_LINK_ROLE_OPTIONS,
  TENANT_LINK_STATUS_OPTIONS,
  type TenantLinkRole,
  type TenantLinkStatus,
  type TenantUnitLinkRecord
} from "./tenantUnitLinkTypes";
import { findActiveLinksForTenant } from "../../../services/tenantUnitLinksSupabase";

export type LinkTenantFormState = {
  tenantId: string;
  role: TenantLinkRole;
  status: TenantLinkStatus;
  isPrimary: boolean;
  startDate: string;
  endDate: string;
  notes: string;
};

export function LinkTenantToUnitModal({
  open,
  unitName,
  propertyId,
  unitId,
  tenants,
  existingLinks,
  saving,
  onClose,
  onSubmit
}: {
  open: boolean;
  unitName: string;
  propertyId: string;
  unitId: string | null;
  tenants: Array<{ id: string; firstName?: string; lastName?: string; email?: string | null }>;
  existingLinks: TenantUnitLinkRecord[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (form: LinkTenantFormState) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<LinkTenantFormState>({
    tenantId: "",
    role: "occupant",
    status: "active",
    isPrimary: false,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: ""
  });
  const [otherUnitWarning, setOtherUnitWarning] = useState<string | null>(null);
  const [confirmOtherUnit, setConfirmOtherUnit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setForm({
      tenantId: "",
      role: "occupant",
      status: "active",
      isPrimary: false,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      notes: ""
    });
    setOtherUnitWarning(null);
    setConfirmOtherUnit(false);
  }, [open, unitId]);

  const activeTenantIdsOnUnit = useMemo(
    () => new Set(existingLinks.filter((l) => l.status === "active").map((l) => l.tenantId)),
    [existingLinks]
  );

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (activeTenantIdsOnUnit.has(String(t.id))) return false;
      if (!q) return true;
      const name = `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim().toLowerCase();
      const email = String(t.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [tenants, search, activeTenantIdsOnUnit]);

  useEffect(() => {
    if (!form.tenantId) {
      setOtherUnitWarning(null);
      setConfirmOtherUnit(false);
      return;
    }
    void (async () => {
      try {
        const active = await findActiveLinksForTenant(form.tenantId);
        const elsewhere = active.filter((l) => l.propertyId === propertyId && (l.unitId ?? null) !== (unitId ?? null));
        if (elsewhere.length > 0) {
          setOtherUnitWarning("This tenant is already actively linked to another unit on this property.");
          setConfirmOtherUnit(false);
        } else {
          setOtherUnitWarning(null);
          setConfirmOtherUnit(false);
        }
      } catch {
        setOtherUnitWarning(null);
      }
    })();
  }, [form.tenantId, propertyId, unitId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.tenantId) return;
    if (otherUnitWarning && !confirmOtherUnit) return;
    await onSubmit(form);
  };

  if (!open) return null;

  return (
    <>
      <ModalOverlay open onClose={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
        <ModalPanel
          title={`Link tenant — ${unitName}`}
          onClose={onClose}
          actions={
            <button className="pg-btn pg-btn-primary" type="submit" form="link-tenant-unit-form" disabled={!form.tenantId || saving}>
              {saving ? "Linking…" : "Link Tenant"}
            </button>
          }
        >
          <form id="link-tenant-unit-form" onSubmit={(e) => void submit(e)} style={{ display: "grid", gap: 12 }}>
            <p className="pg-muted" style={{ margin: 0 }}>
              Select an existing tenant. New profiles are created from the{" "}
              <Link className="pg-link" to="/tenants/new">
                Tenants
              </Link>{" "}
              page.
            </p>

            <Input placeholder="Search tenant…" value={search} onChange={(e) => setSearch(e.target.value)} />

            <div style={{ maxHeight: "28vh", overflow: "auto" }} className="pg-workspace-inset-list">
              {filteredTenants.length ? (
                filteredTenants.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="pg-workspace-inset"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: String(form.tenantId) === String(t.id) ? "1px solid var(--primary-border)" : undefined
                    }}
                    onClick={() => setForm((prev) => ({ ...prev, tenantId: String(t.id) }))}
                  >
                    <strong>
                      {t.firstName} {t.lastName}
                    </strong>
                    <div className="pg-muted" style={{ fontSize: 13 }}>
                      {t.email ?? "No email"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="pg-muted">No eligible tenants found.</div>
              )}
            </div>

            <label className="pg-muted" style={{ fontSize: 13 }}>
              Role
              <select className="pg-input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as TenantLinkRole }))}>
                {TENANT_LINK_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="pg-muted" style={{ fontSize: 13 }}>
              Link status
              <select
                className="pg-input"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TenantLinkStatus }))}
              >
                {TENANT_LINK_STATUS_OPTIONS.filter((o) => o.value !== "removed" && o.value !== "ended").map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="pg-prop-grid pg-prop-grid--2">
              <label className="pg-muted" style={{ fontSize: 13 }}>
                Start date
                <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              </label>
              <label className="pg-muted" style={{ fontSize: 13 }}>
                End date (optional)
                <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
              </label>
            </div>

            <label className="pg-muted" style={{ fontSize: 13 }}>
              Notes (optional)
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked, role: e.target.checked ? "primary_tenant" : p.role }))}
              />
              Set as primary tenant for this unit
            </label>

            {otherUnitWarning ? (
              <div className="pg-alert" role="alert">
                <p style={{ margin: "0 0 8px" }}>{otherUnitWarning}</p>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={confirmOtherUnit} onChange={(e) => setConfirmOtherUnit(e.target.checked)} />I understand — link anyway
                </label>
              </div>
            ) : null}

            <p className="pg-muted" style={{ fontSize: 12, margin: 0 }}>
              Leases are not created automatically. After linking, create a lease from the{" "}
              <Link className="pg-link" to="/leases/new">
                Leases
              </Link>{" "}
              page when ready.
            </p>
          </form>
        </ModalPanel>
      </div>
    </>
  );
}
