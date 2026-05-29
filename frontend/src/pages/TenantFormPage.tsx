import { FormEvent, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { createTenant, getProperties, getTenant, listPropertyUnits, updateTenant } from "../api/ownedProperties";
import type { PropertyUnitDraft } from "../features/properties/units/propertyUnitTypes";

export function TenantFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<PropertyUnitDraft[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    idNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    appliedPropertyId: "",
    appliedUnitId: ""
  });

  useEffect(() => {
    void (async () => {
      try {
        setProperties(await getProperties());
      } catch {
        setProperties([]);
      }
    })();
  }, []);

  useEffect(() => {
    const pid = form.appliedPropertyId;
    if (!pid) {
      setUnits([]);
      return;
    }
    void (async () => {
      setUnitsLoading(true);
      try {
        const rows = await listPropertyUnits(pid);
        setUnits(rows.filter((u) => u.isActive !== false));
      } catch {
        setUnits([]);
      } finally {
        setUnitsLoading(false);
      }
    })();
  }, [form.appliedPropertyId]);

  const showAppliedUnit = form.appliedPropertyId !== "" && units.length > 1;

  const activeUnits = useMemo(() => units.filter((u) => u.isActive !== false), [units]);

  useEffect(() => {
    if (!showAppliedUnit && form.appliedUnitId) {
      setForm((prev) => ({ ...prev, appliedUnitId: "" }));
    }
  }, [showAppliedUnit, form.appliedUnitId]);

  useEffect(() => {
    if (!isEdit || !id) return;
    void (async () => {
      try {
        const data = await getTenant(id);
        const t = data.tenant as Record<string, unknown>;
        setForm({
          firstName: String(t.firstName ?? ""),
          lastName: String(t.lastName ?? ""),
          email: String(t.email ?? ""),
          phone: String(t.phone ?? ""),
          idNumber: String(t.idNumber ?? ""),
          emergencyContactName: String(t.emergencyContactName ?? ""),
          emergencyContactPhone: String(t.emergencyContactPhone ?? ""),
          appliedPropertyId:
            t.appliedPropertyId != null && String(t.appliedPropertyId) !== "" ? String(t.appliedPropertyId) : "",
          appliedUnitId: t.appliedUnitId != null && String(t.appliedUnitId) !== "" ? String(t.appliedUnitId) : ""
        });
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Failed to load tenant.");
      }
    })();
  }, [id, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        idNumber: form.idNumber || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        appliedPropertyId: form.appliedPropertyId === "" ? null : String(form.appliedPropertyId),
        appliedUnitId:
          showAppliedUnit && form.appliedUnitId !== "" ? String(form.appliedUnitId) : null
      };
      if (isEdit && id) {
        await updateTenant(id, payload);
        navigate(`/tenants/${id}`);
      } else {
        const created = await createTenant(payload);
        navigate(`/tenants/${created.id}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>{isEdit ? "Edit Tenant" : "Add Tenant"} | The Property Guy</title>
      </Helmet>
      <Container>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h1 className="pg-h2" style={{ margin: 0 }}>
              {isEdit ? "Edit Tenant" : "Add Tenant"}
            </h1>
            <Link className="pg-btn pg-btn-ghost" to="/tenants">
              Back to tenants
            </Link>
          </div>
          {error ? (
            <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>
              {error}
            </div>
          ) : null}
          <form onSubmit={submit} style={{ marginTop: 12 }}>
            <Field label="First name">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </Field>
            <Field label="Email (optional)">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone (optional)">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="ID number (optional)">
              <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
            </Field>
            <Field label="Emergency contact name (optional)">
              <Input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            </Field>
            <Field label="Emergency contact phone (optional)">
              <Input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </Field>
            <Field label="Applied property (optional)">
              <select
                className="pg-input"
                value={form.appliedPropertyId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    appliedPropertyId: e.target.value,
                    appliedUnitId: ""
                  })
                }
              >
                <option value="">None</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                Records which property the tenant applied for. This does not link them to the property — use Link Tenants on the
                property page when ready.
              </p>
            </Field>
            {showAppliedUnit ? (
              <Field label="Applied unit">
                <select
                  className="pg-input"
                  value={form.appliedUnitId}
                  onChange={(e) => setForm({ ...form, appliedUnitId: e.target.value })}
                  disabled={unitsLoading}
                >
                  <option value="">Select unit</option>
                  {activeUnits.map((u) => (
                    <option key={u.id ?? u.clientId} value={u.id ?? ""}>
                      {u.unitName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : "Create tenant"}
            </Button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
