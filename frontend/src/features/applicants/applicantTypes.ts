import type { ApplicantFieldValues, ApplicantFormTemplate } from "./applicantFormTemplate";
import { DEFAULT_APPLICANT_FORM_TEMPLATE, emptyFieldValues, fieldValuesFromRecord } from "./applicantFormTemplate";

export type ApplicantSubmissionPayload = {
  primary: ApplicantFieldValues;
  coApplicantEnabled: boolean;
  coApplicant?: ApplicantFieldValues | null;
  template?: ApplicantFormTemplate;
};

export type ApplicantInvitePublicContext = {
  propertyName: string;
  propertyAddress: string;
  unitName?: string | null;
  targetRent: number;
  formTemplate: ApplicantFormTemplate;
};

export type ApplicantApplicationRecord = {
  tenantId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  propertyId: string | null;
  propertyName: string | null;
  monthlyIncome: number;
  fitScore: number;
  targetRent: number;
  submittedAt: string | null;
  formData: ApplicantSubmissionPayload | null;
  previousResidency: string | null;
  landlordContact: string | null;
  timeRented: string | null;
  additionalOccupants: string | null;
  hasAnimals: boolean;
  catCount: number;
  dogCount: number;
};

export function buildSubmissionPayload(
  template: ApplicantFormTemplate,
  primary: ApplicantFieldValues,
  coApplicantEnabled: boolean,
  coApplicant: ApplicantFieldValues
): ApplicantSubmissionPayload {
  return {
    primary,
    coApplicantEnabled,
    coApplicant: coApplicantEnabled ? coApplicant : null,
    template
  };
}

export function submissionPayloadFromRecord(
  record: ApplicantApplicationRecord,
  template: ApplicantFormTemplate = DEFAULT_APPLICANT_FORM_TEMPLATE
): ApplicantSubmissionPayload {
  const form = record.formData;
  const activeTemplate = form?.template ? form.template : template;
  if (form?.primary) {
    return {
      primary: fieldValuesFromRecord(activeTemplate, form.primary as Record<string, unknown>),
      coApplicantEnabled: Boolean(form.coApplicantEnabled && form.coApplicant),
      coApplicant: form.coApplicant
        ? fieldValuesFromRecord(activeTemplate, form.coApplicant as Record<string, unknown>)
        : emptyFieldValues(activeTemplate),
      template: activeTemplate
    };
  }
  const primary = emptyFieldValues(activeTemplate);
  primary.firstName = record.firstName;
  primary.lastName = record.lastName;
  if (primary.email !== undefined) primary.email = record.email ?? "";
  if (primary.phone !== undefined) primary.phone = record.phone ?? "";
  if (primary.monthlyIncome !== undefined) primary.monthlyIncome = record.monthlyIncome ? String(record.monthlyIncome) : "";
  if (primary.previousResidency !== undefined) primary.previousResidency = record.previousResidency ?? "";
  if (primary.landlordContact !== undefined) primary.landlordContact = record.landlordContact ?? "";
  if (primary.timeRented !== undefined) primary.timeRented = record.timeRented ?? "";
  primary.additionalOccupants = record.additionalOccupants ?? "";
  primary.hasAnimals = record.hasAnimals ? "yes" : "no";
  primary.catCount = String(record.catCount ?? 0);
  primary.dogCount = String(record.dogCount ?? 0);
  return {
    primary,
    coApplicantEnabled: false,
    coApplicant: emptyFieldValues(activeTemplate),
    template: activeTemplate
  };
}

export type { ApplicantFieldValues, ApplicantFormTemplate } from "./applicantFormTemplate";
export {
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  emptyFieldValues,
  fieldValuesFromRecord,
  combinedIncomeFromValues,
  personPayloadFromValues,
  isApplicantApplicationComplete,
  validateApplicantApplicationValues,
  formatApplicantAnimalsSummary,
  formatAdditionalOccupants,
  applicantHasAnimals,
  parseAnimalCount
} from "./applicantFormTemplate";
