import { FormEvent, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ApplicantDocumentUploadSection } from "../features/applicants/ApplicantDocumentUploadSection";
import { ApplicantTemplateFields } from "../features/applicants/ApplicantTemplateFields";
import {
  allApplicantDocumentGroupsComplete,
  type ApplicantPendingDocuments
} from "../features/applicants/applicantDocumentSlots";
import {
  buildSubmissionPayload,
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  emptyFieldValues,
  isApplicantApplicationComplete,
  type ApplicantFormTemplate
} from "../features/applicants/applicantTypes";
import {
  getApplicantInvitePublic,
  submitApplicantApplication
} from "../services/applicantApplicationsSupabase";
import { uploadApplicantDocumentsPublic } from "../services/tenantDocumentsSupabase";
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
  const [pendingDocuments, setPendingDocuments] = useState<ApplicantPendingDocuments>({});

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

  const detailsComplete = useMemo(
    () => isApplicantApplicationComplete(template, primary, coEnabled, coApplicant, { coEmailRequired: false }),
    [template, primary, coEnabled, coApplicant]
  );
  const documentsComplete = useMemo(() => allApplicantDocumentGroupsComplete(pendingDocuments), [pendingDocuments]);
  const canSubmit = detailsComplete && documentsComplete && !submitted && !submitting;

  const submitApplication = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || submitted || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitApplicantApplication(
        token,
        template,
        buildSubmissionPayload(template, primary, coEnabled, coApplicant)
      );
      if (!result.tenantId) {
        throw new Error("Application was saved but could not attach documents.");
      }
      await uploadApplicantDocumentsPublic(token, result.tenantId, pendingDocuments);
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

          {!loading && error && !propertyName ? (
            <div>
              <h1 className="pg-h2" style={{ marginTop: 0 }}>
                Application unavailable
              </h1>
              <p className="pg-muted">{error}</p>
            </div>
          ) : null}

          {!loading && propertyName ? (
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

              {submitted ? (
                <div
                  className="pg-alert"
                  role="status"
                  style={{
                    marginBottom: 16,
                    borderColor: "var(--success)",
                    background: "var(--success-soft)",
                    color: "var(--text-primary)"
                  }}
                >
                  Application submitted successfully. The property owner will review your details and documents.
                </div>
              ) : null}

              {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

              <form onSubmit={submitApplication}>
                {template.allowCoApplicant ? (
                  <label className="pg-applicant-co-toggle">
                    <input
                      type="checkbox"
                      checked={coEnabled}
                      disabled={submitted}
                      onChange={(e) => setCoEnabled(e.target.checked)}
                    />
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
                      disabled={submitted}
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
                        disabled={submitted}
                      />
                    </div>
                  ) : null}
                </div>

                <ApplicantDocumentUploadSection
                  mode="draft"
                  pendingBySlot={pendingDocuments}
                  onPendingBySlotChange={setPendingDocuments}
                  disabled={submitted}
                  readOnly={submitted}
                />

                {!submitted ? (
                  <div style={{ marginTop: 20 }}>
                    <Button id="applicant-submit-application" type="submit" loading={submitting} disabled={!canSubmit}>
                      Submit application
                    </Button>
                    <p className="pg-muted pg-applicant-documents__hint" style={{ marginTop: 12, marginBottom: 0 }}>
                      {canSubmit
                        ? "Ready to submit your application and documents."
                        : !detailsComplete
                          ? "Complete all required fields to submit."
                          : "Upload ID, three payslips, and three bank statements to submit."}
                    </p>
                  </div>
                ) : null}
              </form>
            </>
          ) : null}
        </Card>
      </Container>
    </Section>
  );
}
