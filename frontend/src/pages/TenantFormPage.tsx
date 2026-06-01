import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppFormPage, AppPageHeader, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button, ButtonLink } from "../components/ui/Button";
import { createTenant, getTenant, updateTenant } from "../api/ownedProperties";
import { UseApplicantModal, type ApplicantPrefill } from "../features/applicants/UseApplicantModal";
import { getApplicantApplicationOwner } from "../services/applicantApplicationsSupabase";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  idNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: ""
};

export function TenantFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const isApplicant = !isEdit && searchParams.get("kind") === "applicant";
  const prefillApplicantId = !isEdit ? searchParams.get("applicantId") : null;
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [useApplicantOpen, setUseApplicantOpen] = useState(false);
  const [sourceApplicantId, setSourceApplicantId] = useState<string | null>(null);
  const [sourceApplicantName, setSourceApplicantName] = useState("");
  const [sourcePropertyId, setSourcePropertyId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } };
        setError(err?.response?.data?.message ?? "Failed to load tenant.");
      }
    })();
  }, [id, isEdit]);

  useEffect(() => {
    if (isEdit || !prefillApplicantId) return;
    let cancelled = false;
    void getApplicantApplicationOwner(prefillApplicantId)
      .then((record) => {
        if (cancelled) return;
        applyApplicantPrefill({
          applicantId: record.tenantId,
          applicantName: record.fullName,
          propertyId: record.propertyId,
          form: {
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email ?? "",
            phone: record.phone ?? "",
            idNumber:
              record.formData?.coApplicantEnabled &&
              record.formData?.coApplicant &&
              String(record.formData.coApplicant.firstName ?? "").trim() === record.firstName.trim() &&
              String(record.formData.coApplicant.lastName ?? "").trim() === record.lastName.trim()
                ? record.formData.coApplicant.idNumber != null
                  ? String(record.formData.coApplicant.idNumber)
                  : ""
                : record.formData?.primary?.idNumber != null
                  ? String(record.formData.primary.idNumber)
                  : "",
            emergencyContactName: "",
            emergencyContactPhone: ""
          }
        });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the selected applicant.");
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, prefillApplicantId]);

  const applyApplicantPrefill = (prefill: ApplicantPrefill) => {
    setSourceApplicantId(prefill.applicantId);
    setSourceApplicantName(prefill.applicantName);
    setSourcePropertyId(prefill.propertyId);
    setForm(prefill.form);
    setError("");
  };

  const clearApplicantLink = () => {
    setSourceApplicantId(null);
    setSourceApplicantName("");
    setSourcePropertyId(null);
  };

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
      } else if (sourceApplicantId) {
        await updateTenant(sourceApplicantId, {
          ...payload,
          status: "ACTIVE",
          ...(sourcePropertyId ? { propertyId: sourcePropertyId } : {})
        });
        navigate(`/tenants/${sourceApplicantId}`);
      } else {
        const created = await createTenant(isApplicant ? { ...payload, status: "APPLICANT" } : payload);
        navigate(`/tenants/${created.id}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isEdit ? "Edit Tenant" : isApplicant ? "Add Applicant" : "Add Tenant";
  const backHref = isApplicant ? "/tenants?tab=applicants" : "/tenants";

  return (
    <AppFormPage className="pg-tenant-form-page">
      <Helmet>
        <title>{pageTitle} | The Property Guy</title>
      </Helmet>
      <AppPageHeader>
        <div className="pg-app-page-header__main">
          <AppPageTitle>{pageTitle}</AppPageTitle>
          <AppPageSubtitle>
            {isApplicant
              ? "Applicants are contact records in your vetting pipeline. Promote to a tenant before creating a lease."
              : "Tenants are global contact records. Link a tenant to a property and unit by creating a lease."}
          </AppPageSubtitle>
        </div>
        <ButtonLink href={backHref} variant="ghost">
          Back to {isApplicant ? "applicants" : "tenants"}
        </ButtonLink>
      </AppPageHeader>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

      {!isEdit && sourceApplicantId ? (
        <div className="pg-tenant-form-applicant-banner">
          <div>
            <strong>Linked applicant</strong>
            <p className="pg-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              {sourceApplicantName}. Creating the tenant will promote this applicant and keep their application profile on
              the tenant statement.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={clearApplicantLink}>
            Clear
          </Button>
        </div>
      ) : null}

      <Card className="pg-tenant-form-card">
        <form onSubmit={submit} className="pg-tenant-form">
          <div className="pg-tenant-form__grid">
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
              <Input
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
              />
            </Field>
            <Field label="Emergency contact phone (optional)">
              <Input
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
              />
            </Field>
          </div>
          <div className="pg-tenant-form__actions">
            {!isEdit && !isApplicant ? (
              <Button type="button" variant="soft" onClick={() => setUseApplicantOpen(true)}>
                Use applicant
              </Button>
            ) : null}
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : sourceApplicantId ? "Create tenant from applicant" : "Create tenant"}
            </Button>
          </div>
        </form>
      </Card>

      <UseApplicantModal
        open={useApplicantOpen}
        onOpenChange={setUseApplicantOpen}
        onSelect={applyApplicantPrefill}
      />
    </AppFormPage>
  );
}
