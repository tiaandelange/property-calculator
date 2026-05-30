import type { ApplicantApplicationRecord } from "../../applicants/applicantTypes";
import { fmtZar } from "../tenantDirectoryUtils";

function fitClass(score: number): string {
  if (score >= 80) return "pg-applicant-fit pg-applicant-fit--success";
  if (score >= 50) return "pg-applicant-fit pg-applicant-fit--warning";
  return "pg-applicant-fit pg-applicant-fit--danger";
}

export function TenantApplicantDetailsCard({
  record,
  loading
}: {
  record: ApplicantApplicationRecord | null;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="pg-tstmt-applicant-card pg-tstmt-skeleton" aria-busy="true" />;
  }
  if (!record) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Monthly income", value: fmtZar(record.monthlyIncome) },
    { label: "Target rent", value: fmtZar(record.targetRent) },
    { label: "Fit profile", value: `${Math.round(record.fitScore)}%` },
    ...(record.previousResidency ? [{ label: "Previous residency", value: record.previousResidency }] : []),
    ...(record.landlordContact ? [{ label: "Landlord contact", value: record.landlordContact }] : []),
    ...(record.timeRented ? [{ label: "Time rented", value: record.timeRented }] : []),
    ...(record.submittedAt
      ? [{ label: "Application submitted", value: new Date(record.submittedAt).toLocaleDateString("en-ZA") }]
      : [])
  ];

  return (
    <section className="pg-tstmt-applicant-card pg-workspace-card">
      <div className="pg-tstmt-applicant-card__head">
        <div>
          <h2 className="pg-tstmt-applicant-card__title">Application profile</h2>
          <p className="pg-tstmt-applicant-card__desc pg-muted">
            Details from the linked applicant submission.
          </p>
        </div>
        <span className={fitClass(record.fitScore)}>{Math.round(record.fitScore)}% fit</span>
      </div>
      <dl className="pg-tstmt-applicant-card__grid">
        {rows.map((row) => (
          <div key={row.label} className="pg-tstmt-applicant-card__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
