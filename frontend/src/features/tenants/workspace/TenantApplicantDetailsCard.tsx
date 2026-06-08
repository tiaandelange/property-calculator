import type { ApplicantApplicationRecord } from "../../applicants/applicantTypes";
import {
  formatAdditionalOccupants,
  formatApplicantAnimalsSummary
} from "../../applicants/applicantFormTemplate";
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

  const additionalOccupants = formatAdditionalOccupants(record.additionalOccupants);
  const animalsSummary = formatApplicantAnimalsSummary({
    hasAnimals: record.hasAnimals ? "yes" : "no",
    catCount: String(record.catCount),
    dogCount: String(record.dogCount)
  });

  const rows: Array<{ label: string; value: string }> = [
    { label: "Monthly income", value: fmtZar(record.monthlyIncome) },
    ...(additionalOccupants ? [{ label: "Additional occupants", value: additionalOccupants }] : []),
    { label: "Target rent", value: fmtZar(record.targetRent) },
    { label: "Fit profile", value: `${Math.round(record.fitScore)}%` },
    ...(record.previousResidency ? [{ label: "Previous residency", value: record.previousResidency }] : []),
    ...(record.landlordContact ? [{ label: "Landlord contact", value: record.landlordContact }] : []),
    ...(record.timeRented ? [{ label: "Time rented", value: record.timeRented }] : []),
    { label: "Pets", value: animalsSummary },
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
