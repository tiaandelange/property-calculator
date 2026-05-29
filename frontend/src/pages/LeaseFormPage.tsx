import { FormEvent, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  createLease,
  getProperties,
  getTenants,
  listPropertyUnits,
  propertyApiErrorMessage
} from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import type { PropertyUnitDraft } from "../features/properties/units/propertyUnitTypes";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

const LEASE_TENANT_ROLES = [
  { value: "primary_tenant", label: "Primary tenant" },
  { value: "co_tenant", label: "Co-tenant" },
  { value: "spouse", label: "Spouse" },
  { value: "occupant", label: "Occupant" },
  { value: "guarantor", label: "Guarantor" }
] as const;

export function LeaseFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillPropertyId = searchParams.get("propertyId") ?? "";

  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [units, setUnits] = useState<PropertyUnitDraft[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [primaryTenantId, setPrimaryTenantId] = useState("");
  const [tenantRoles, setTenantRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    unitId: "",
    startDate: "",
    leaseType: "FIXED_TERM",
    fixedTermEndDate: "",
    monthlyRent: "",
    depositAmount: "",
    rentDueDay: 1,
    notes: ""
  });

  useEffect(() => {
    void (async () => {
      const rows = await getProperties();
      setProperties(rows);
      const initial = prefillPropertyId || (rows[0] ? String(rows[0].id) : "");
      if (initial) setPropertyId(initial);
    })();
  }, [prefillPropertyId]);

  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setForm((prev) => ({ ...prev, unitId: "" }));
      return;
    }
    void (async () => {
      setUnitsLoading(true);
      try {
        const rows = await listPropertyUnits(propertyId);
        const active = rows.filter((u) => u.isActive !== false);
        setUnits(active);
        setForm((prev) => {
          const stillValid = active.some((u) => String(u.id) === prev.unitId);
          if (stillValid) return prev;
          const only = active.length === 1 && active[0]?.id ? String(active[0].id) : "";
          return { ...prev, unitId: only };
        });
      } catch {
        setUnits([]);
      } finally {
        setUnitsLoading(false);
      }
    })();
  }, [propertyId]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await getTenants();
        setTenants(Array.isArray(rows) ? rows : []);
      } catch {
        setTenants([]);
      }
    })();
  }, []);

  const showUnitField = units.length > 1;

  const selectedTenants = useMemo(
    () => tenants.filter((t) => selectedTenantIds.includes(String(t.id))),
    [tenants, selectedTenantIds]
  );

  const toggleTenant = (tenantId: string) => {
    setSelectedTenantIds((prev) => {
      const has = prev.includes(tenantId);
      if (has) {
        const next = prev.filter((id) => id !== tenantId);
        if (primaryTenantId === tenantId) {
          setPrimaryTenantId(next[0] ?? "");
        }
        setTenantRoles((roles) => {
          const copy = { ...roles };
          delete copy[tenantId];
          return copy;
        });
        return next;
      }
      if (!primaryTenantId) setPrimaryTenantId(tenantId);
      setTenantRoles((roles) => ({ ...roles, [tenantId]: tenantId === primaryTenantId ? "primary_tenant" : "co_tenant" }));
      return [...prev, tenantId];
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!selectedTenantIds.length || !primaryTenantId) {
      setError("Select at least one tenant and mark a primary tenant.");
      return;
    }
    if (showUnitField && !form.unitId) {
      setError("Select a unit for this property.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const leaseTenants = selectedTenantIds.map((tenantId) => ({
        tenantId,
        role: tenantId === primaryTenantId ? "primary_tenant" : tenantRoles[tenantId] ?? "co_tenant",
        isPrimary: tenantId === primaryTenantId
      }));
      await createLease(propertyId, {
        tenantId: primaryTenantId,
        unitId: form.unitId || null,
        leaseTenants,
        startDate: form.startDate,
        leaseType: form.leaseType,
        fixedTermEndDate: form.leaseType === "FIXED_TERM" ? form.fixedTermEndDate : null,
        monthlyRent: Number(form.monthlyRent),
        depositAmount: Number(form.depositAmount),
        rentDueDay: Number(form.rentDueDay),
        notes: form.notes || undefined
      });
      invalidatePropertyWorkspace(propertyId);
      navigate(`/owned-properties/${propertyId}?tab=tenants`);
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Create Lease | The Property Guy</title>
      </Helmet>
      <Container>
        <div className="pg-workspace-page">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h1 className="pg-h2" style={{ margin: 0 }}>
              Create Lease
            </h1>
            <Link className="pg-btn pg-btn-ghost" to="/leases">
              Back to Leases
            </Link>
          </div>
          <p className="pg-muted" style={{ fontSize: 13, margin: 0 }}>
            Leases connect tenants to a property and unit. Rent, invoices, and statements flow from the lease.
          </p>
          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
          <Card>
            <form onSubmit={submit}>
              <Field label="Property">
                <select
                  className="pg-input"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  required
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              {showUnitField ? (
                <Field label="Unit">
                  <select
                    className="pg-input"
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    disabled={unitsLoading}
                    required
                  >
                    <option value="">Select unit</option>
                    {units.map((u) => (
                      <option key={u.id ?? u.clientId} value={u.id ?? ""}>
                        {u.unitName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Lease tenants">
                <div className="pg-workspace-inset-list" style={{ marginTop: 4 }}>
                  {tenants.length === 0 ? (
                    <p className="pg-muted" style={{ margin: 0, fontSize: 13 }}>
                      No tenants yet.{" "}
                      <Link className="pg-link" to="/tenants/new">
                        Create a tenant
                      </Link>{" "}
                      first, then return here.
                    </p>
                  ) : (
                    tenants.map((t) => {
                      const tid = String(t.id);
                      const selected = selectedTenantIds.includes(tid);
                      return (
                        <label
                          key={tid}
                          className="pg-workspace-inset"
                          style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}
                        >
                          <input type="checkbox" checked={selected} onChange={() => toggleTenant(tid)} />
                          <span style={{ flex: 1 }}>
                            <strong>
                              {t.firstName} {t.lastName}
                            </strong>
                            {t.email ? <span className="pg-muted"> · {String(t.email)}</span> : null}
                            {selected ? (
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                                <label className="pg-muted" style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
                                  <input
                                    type="radio"
                                    name="primaryTenant"
                                    checked={primaryTenantId === tid}
                                    onChange={() => {
                                      setPrimaryTenantId(tid);
                                      setTenantRoles((roles) => ({ ...roles, [tid]: "primary_tenant" }));
                                    }}
                                  />
                                  Primary tenant
                                </label>
                                <select
                                  className="pg-input"
                                  style={{ width: "auto", minWidth: 140 }}
                                  value={tenantRoles[tid] ?? "co_tenant"}
                                  disabled={primaryTenantId === tid}
                                  onChange={(e) => setTenantRoles((roles) => ({ ...roles, [tid]: e.target.value }))}
                                >
                                  {LEASE_TENANT_ROLES.filter((r) => r.value !== "primary_tenant" || primaryTenantId === tid).map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </Field>
              <Field label="Start date">
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </Field>
              <Field label="Lease type">
                <select className="pg-input" value={form.leaseType} onChange={(e) => setForm({ ...form, leaseType: e.target.value })}>
                  <option value="FIXED_TERM">Fixed term</option>
                  <option value="MONTH_TO_MONTH">Month-to-month</option>
                </select>
              </Field>
              {form.leaseType === "FIXED_TERM" ? (
                <Field label="End date">
                  <Input
                    type="date"
                    value={form.fixedTermEndDate}
                    onChange={(e) => setForm({ ...form, fixedTermEndDate: e.target.value })}
                    required
                  />
                </Field>
              ) : null}
              <Field label="Monthly rent">
                <Input
                  type="number"
                  value={form.monthlyRent}
                  onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
                  required
                />
              </Field>
              <Field label="Deposit amount">
                <Input
                  type="number"
                  value={form.depositAmount}
                  onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
                  required
                />
              </Field>
              <Field label="Rent due day">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.rentDueDay}
                  onChange={(e) => setForm({ ...form, rentDueDay: Number(e.target.value) })}
                />
              </Field>
              <Field label="Notes (optional)">
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <Button type="submit" loading={saving}>
                  Create Lease
                </Button>
                <Link className="pg-btn pg-btn-ghost" to="/leases">
                  Cancel
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
