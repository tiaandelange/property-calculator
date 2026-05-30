import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button, ButtonLink } from "../components/ui/Button";
import { createTenant, getTenant, updateTenant } from "../api/ownedProperties";

export function TenantFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const isApplicant = !isEdit && searchParams.get("kind") === "applicant";
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    idNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: ""
  });

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
          emergencyContactPhone: String(t.emergencyContactPhone ?? "")
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
        emergencyContactPhone: form.emergencyContactPhone || undefined
      };
      if (isEdit && id) {
        await updateTenant(id, payload);
        navigate(`/tenants/${id}`);
      } else {
        const created = await createTenant(isApplicant ? { ...payload, status: "APPLICANT" } : payload);
        navigate(`/tenants/${created.id}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isEdit ? "Edit Tenant" : isApplicant ? "Add Applicant" : "Add Tenant";
  const backHref = isApplicant ? "/tenants?tab=applicants" : "/tenants";

  return (
    <Section>
      <Helmet>
        <title>{pageTitle} | The Property Guy</title>
      </Helmet>
      <Container>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h1 className="pg-h2" style={{ margin: 0 }}>
              {pageTitle}
            </h1>
            <ButtonLink href={backHref} variant="ghost">
              Back to {isApplicant ? "applicants" : "tenants"}
            </ButtonLink>
          </div>
          <p className="pg-muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
            {isApplicant
              ? "Applicants are contact records in your vetting pipeline. Link to a property and create a lease when ready."
              : "Tenants are global contact records. Link a tenant to a property and unit by creating a lease."}
          </p>
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
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : "Create tenant"}
            </Button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
