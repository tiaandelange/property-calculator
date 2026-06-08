import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { ApplicantDocumentUploadSection } from "./ApplicantDocumentUploadSection";
import { ApplicantTemplateFields } from "./ApplicantTemplateFields";
import { applicantTemplateForPerson } from "./applicantFormTemplate";
import {
  buildSubmissionPayload,
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  emptyFieldValues,
  submissionPayloadFromRecord,
  type ApplicantApplicationRecord,
  type ApplicantFormTemplate
} from "./applicantTypes";
import { getApplicantApplicationOwner, updateApplicantApplicationOwner } from "../../services/applicantApplicationsSupabase";
import { getOrCreateUserSettings } from "../../services/settingsSupabase";
import { fmtZar } from "../tenants/tenantDirectoryUtils";

export function ApplicantDetailModal({
  tenantId,
  open,
  onClose,
  onSaved
}: {
  tenantId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState<ApplicantApplicationRecord | null>(null);
  const [template, setTemplate] = useState<ApplicantFormTemplate>(DEFAULT_APPLICANT_FORM_TEMPLATE);
  const [primary, setPrimary] = useState(emptyFieldValues(DEFAULT_APPLICANT_FORM_TEMPLATE));
  const [coApplicant, setCoApplicant] = useState(emptyFieldValues(DEFAULT_APPLICANT_FORM_TEMPLATE));
  const [coEnabled, setCoEnabled] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.all([getApplicantApplicationOwner(tenantId), getOrCreateUserSettings()])
      .then(([data, settings]) => {
        if (cancelled) return;
        setRecord(data);
        const activeTemplate = data.formData?.template ?? settings.applicantFormTemplate;
        setTemplate(activeTemplate);
        const payload = submissionPayloadFromRecord(data, activeTemplate);
        setPrimary(payload.primary);
        setCoApplicant(payload.coApplicant ?? emptyFieldValues(activeTemplate));
        setCoEnabled(Boolean(payload.coApplicantEnabled && activeTemplate.allowCoApplicant));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load application.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateApplicantApplicationOwner(
        tenantId,
        template,
        buildSubmissionPayload(template, primary, coEnabled, coApplicant)
      );
      setRecord((prev) => (prev ? { ...prev, fitScore: result.fitScore } : prev));
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={record ? record.fullName : "Applicant application"}
      description={
        record
          ? `Target rent ${fmtZar(record.targetRent)} · Fit ${Math.round(record.fitScore)}% (3× rent rule)`
          : "Review and override applicant details."
      }
      size="lg"
      loading={saving}
      onSubmit={submit}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={saving || loading}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={loading || !record}>
            Save changes
          </Button>
        </div>
      }
    >
      {loading ? <p className="pg-muted">Loading application…</p> : null}
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      {!loading && record ? (
        <>
          {template.allowCoApplicant ? (
            <label className="pg-applicant-co-toggle">
              <input type="checkbox" checked={coEnabled} onChange={(e) => setCoEnabled(e.target.checked)} />
              <span>Add second applicant</span>
            </label>
          ) : null}
          <div className={`pg-applicant-form-grid${coEnabled ? " pg-applicant-form-grid--dual" : ""}`}>
            <div className="pg-applicant-form-grid__col">
              <h3 className="pg-applicant-form-grid__title">{coEnabled ? "Applicant 1" : "Applicant"}</h3>
              <ApplicantTemplateFields prefix="primary" template={template} values={primary} onChange={setPrimary} />
            </div>
            {coEnabled ? (
              <div className="pg-applicant-form-grid__col">
                <h3 className="pg-applicant-form-grid__title">Applicant 2</h3>
                <ApplicantTemplateFields
                  prefix="co"
                  template={applicantTemplateForPerson(template, "co")}
                  values={coApplicant}
                  onChange={setCoApplicant}
                  emailRequired={false}
                />
              </div>
            ) : null}
          </div>
          {tenantId ? (
            <ApplicantDocumentUploadSection mode="owner" tenantId={tenantId} />
          ) : null}
          <p className="pg-muted" style={{ fontSize: 13, marginTop: 12 }}>
            Saving recalculates the fit profile using combined monthly income vs three times the property rent.{" "}
            <Link to="/settings#applicant-form-template">Edit default form template</Link>
          </p>
        </>
      ) : null}
      {!loading && !record && !error ? (
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      ) : null}
    </AppFormModal>
  );
}
