import { FormEvent, useEffect, useState } from "react";
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

export function EditTenantUnitLinkModal({
  open,
  link,
  saving,
  onClose,
  onSubmit
}: {
  open: boolean;
  link: TenantUnitLinkRecord | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (patch: {
    role: TenantLinkRole;
    status: TenantLinkStatus;
    isPrimary: boolean;
    startDate: string;
    endDate: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [role, setRole] = useState<TenantLinkRole>("occupant");
  const [status, setStatus] = useState<TenantLinkStatus>("active");
  const [isPrimary, setIsPrimary] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!link) return;
    setRole(link.role);
    setStatus(link.status);
    setIsPrimary(link.isPrimary);
    setStartDate(link.startDate ?? "");
    setEndDate(link.endDate ?? "");
    setNotes(link.notes ?? "");
  }, [link]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({ role, status, isPrimary, startDate, endDate, notes });
  };

  if (!open || !link) return null;

  return (
    <>
      <ModalOverlay open onClose={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
        <ModalPanel
          title="Edit tenant link"
          onClose={onClose}
          actions={
            <button className="pg-btn pg-btn-primary" type="submit" form="edit-tenant-link-form" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          }
        >
          <form id="edit-tenant-link-form" onSubmit={(e) => void submit(e)} style={{ display: "grid", gap: 12 }}>
            <div>
              <strong>
                {link.tenant?.firstName} {link.tenant?.lastName}
              </strong>
              <div className="pg-muted" style={{ fontSize: 13 }}>
                {link.tenant?.email ?? "No email"}
              </div>
            </div>

            <label className="pg-muted" style={{ fontSize: 13 }}>
              Role
              <select className="pg-input" value={role} onChange={(e) => setRole(e.target.value as TenantLinkRole)}>
                {TENANT_LINK_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="pg-muted" style={{ fontSize: 13 }}>
              Link status
              <select className="pg-input" value={status} onChange={(e) => setStatus(e.target.value as TenantLinkStatus)}>
                {TENANT_LINK_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="pg-prop-grid pg-prop-grid--2">
              <label className="pg-muted" style={{ fontSize: 13 }}>
                Start date
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="pg-muted" style={{ fontSize: 13 }}>
                End date
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <label className="pg-muted" style={{ fontSize: 13 }}>
              Notes
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => {
                  setIsPrimary(e.target.checked);
                  if (e.target.checked) setRole("primary_tenant");
                }}
              />
              Primary tenant for this unit
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="pg-btn pg-btn-ghost" to={`/tenants/${link.tenantId}`}>
                View tenant
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/leases/new">
                Create lease
              </Link>
            </div>
          </form>
        </ModalPanel>
      </div>
    </>
  );
}
