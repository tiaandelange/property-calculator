import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  createLease,
  getProperties,
  getTenantsEligibleForProperty,
  propertyApiErrorMessage
} from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function LeaseFormPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string | number | "">("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tenantId: "",
    startDate: "",
    leaseType: "FIXED_TERM",
    fixedTermEndDate: "",
    monthlyRent: "",
    depositAmount: "",
    rentDueDay: 1
  });

  useEffect(() => {
    void (async () => {
      const rows = await getProperties();
      setProperties(rows);
      if (rows[0]) setPropertyId(rows[0].id as string | number);
    })();
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setTenants([]);
      return;
    }
    void (async () => {
      try {
        const tRows = await getTenantsEligibleForProperty(propertyId);
        const tenantList = Array.isArray(tRows) ? tRows : [];
        setTenants(tenantList);
        setForm((prev) =>
          prev.tenantId && !tenantList.some((t) => String(t.id) === String(prev.tenantId)) ? { ...prev, tenantId: "" } : prev
        );
      } catch {
        setTenants([]);
      }
    })();
  }, [propertyId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setSaving(true);
    setError("");
    if (!form.tenantId) {
      setError("Please select a tenant.");
      setSaving(false);
      return;
    }
    try {
      await createLease(propertyId, {
        ...form,
        monthlyRent: Number(form.monthlyRent),
        depositAmount: Number(form.depositAmount)
      });
      invalidatePropertyWorkspace(propertyId);
      navigate("/leases");
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Add Lease | The Property Guy</title>
      </Helmet>
      <Container>
        <div className="pg-workspace-page">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h1 className="pg-h2" style={{ margin: 0 }}>
              Add Lease
            </h1>
            <Link className="pg-btn pg-btn-ghost" to="/leases">
              Back to Leases
            </Link>
          </div>
          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
          <Card>
            <form onSubmit={submit}>
              <Field label="Property">
                <select
                  className="pg-input"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value === "" ? "" : e.target.value)}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tenant">
                <select
                  className="pg-input"
                  value={form.tenantId}
                  onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                >
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
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
                <Field label="Fixed term end date">
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
