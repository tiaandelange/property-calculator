import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ApplicantDocumentUploadSection } from "../features/applicants/ApplicantDocumentUploadSection";
import { ApplicantTemplateFields } from "../features/applicants/ApplicantTemplateFields";
import {
  buildSubmissionPayload,
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  emptyFieldValues,
  type ApplicantFormTemplate
} from "../features/applicants/applicantTypes";
import {
  getApplicantInvitePublic,
  submitApplicantApplication
} from "../services/applicantApplicationsSupabase";
import { fmtZar } from "../features/tenants/tenantDirectoryUtils";
import { isSupabaseConfigured } from "../lib/supabaseClient";

export function ApplicantApplyPage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [unitName, setUnitName] = useState<string | null>(null);
  const [targetRent, setTargetRent] = useState(0);
  const [template, setTemplate] = useState<ApplicantFormTemplate>(DEFAULT_APPLICANT_FORM_TEMPLATE);
  const [primary, setPrimary] = useState(emptyFieldValues(DEFAULT_APPLICANT_FORM_TEMPLATE));
  const [coApplicant, setCoApplicant] = useState(emptyFieldValues(DEFAULT_APPLICANT_FORM_TEMPLATE));
  const [coEnabled, setCoEnabled] = useState(false);
  const [submittedTenantId, setSubmittedTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This application link is invalid.");
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Applications are unavailable right now.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getApplicantInvitePublic(token)
      .then((ctx) => {
        if (cancelled) return;
        setPropertyName(ctx.propertyName);
        setPropertyAddress(ctx.propertyAddress);
        setUnitName(ctx.unitName ?? null);
        setTargetRent(ctx.targetRent);
        setTemplate(ctx.formTemplate);
        setPrimary(emptyFieldValues(ctx.formTemplate));
        setCoApplicant(emptyFieldValues(ctx.formTemplate));
        setCoEnabled(false);
      })
      .catch(() => {
        if (!cancelled) setError("This application link is invalid or has expired.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitApplicantApplication(
        token,
        template,
        buildSubmissionPayload(template, primary, coEnabled, coApplicant)
      );
      setSubmittedTenantId(result.tenantId);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Tenant application | The Property Guy</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <Container className="pg-applicant-apply-container">
        <Card className="pg-applicant-apply-card">
          {loading ? <p className="pg-muted">Loading application…</p> : null}
          {!loading && submitted ? (
            <div className="pg-applicant-apply-success">
              <h1 className="pg-h2" style={{ marginTop: 0 }}>
                Application submitted
              </h1>
              <p className="pg-muted">
                Thank you. You can upload supporting documents below. The property owner will review your details and
                contact you if needed.
              </p>
              <ApplicantDocumentUploadSection mode="public" tenantId={submittedTenantId} inviteToken={token} />
            </div>
          ) : null}
          {!loading && !submitted && error && !propertyName ? (
            <div>
              <h1 className="pg-h2" style={{ marginTop: 0 }}>
                Application unavailable
              </h1>
              <p className="pg-muted">{error}</p>
            </div>
          ) : null}
          {!loading && !submitted && propertyName ? (
            <>
              <h1 className="pg-h2" style={{ marginTop: 0 }}>
                {template.title}
              </h1>
              {template.description ? (
                <p className="pg-muted" style={{ marginBottom: 12 }}>
                  {template.description}
                </p>
              ) : null}
              <p className="pg-muted" style={{ marginBottom: 16 }}>
                {propertyName}
                {unitName ? ` · ${unitName}` : ""}
                {propertyAddress ? ` · ${propertyAddress}` : ""}
                {targetRent > 0 ? ` · Rent ${fmtZar(targetRent)}` : ""}
              </p>
              {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
              <form onSubmit={submit}>
                {template.allowCoApplicant ? (
                  <label className="pg-applicant-co-toggle">
                    <input type="checkbox" checked={coEnabled} onChange={(e) => setCoEnabled(e.target.checked)} />
                    <span>Add second applicant</span>
                  </label>
                ) : null}
                <div className={`pg-applicant-form-grid${coEnabled ? " pg-applicant-form-grid--dual" : ""}`}>
                  <div className="pg-applicant-form-grid__col">
                    <h2 className="pg-applicant-form-grid__title">{coEnabled ? "Applicant 1" : "Your details"}</h2>
                    <ApplicantTemplateFields
                      prefix="apply-primary"
                      template={template}
                      values={primary}
                      onChange={setPrimary}
                    />
                  </div>
                  {coEnabled ? (
                    <div className="pg-applicant-form-grid__col">
                      <h2 className="pg-applicant-form-grid__title">Applicant 2</h2>
                      <ApplicantTemplateFields
                        prefix="apply-co"
                        template={template}
                        values={coApplicant}
                        onChange={setCoApplicant}
                        emailRequired={false}
                      />
                    </div>
                  ) : null}
                </div>
                <ApplicantDocumentUploadSection
                  mode="public"
                  tenantId={null}
                  inviteToken={token}
                  disabled
                />
                <div style={{ marginTop: 20 }}>
                  <Button type="submit" loading={submitting}>
                    Submit application
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </Card>
      </Container>
    </Section>
  );
}
