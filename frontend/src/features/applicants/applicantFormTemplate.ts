export type ApplicantFieldType = "text" | "email" | "phone" | "income";

export type ApplicantFormFieldDef = {
  id: string;
  label: string;
  type: ApplicantFieldType;
  required: boolean;
  width?: "full" | "half";
  placeholder?: string;
  system?: boolean;
};

export type ApplicantFormTemplate = {
  title: string;
  description: string;
  allowCoApplicant: boolean;
  fields: ApplicantFormFieldDef[];
};

export type ApplicantFieldValues = Record<string, string>;

const REQUIRED_SYSTEM_IDS = ["firstName", "lastName", "email", "monthlyIncome"] as const;

export const DEFAULT_APPLICANT_FORM_TEMPLATE: ApplicantFormTemplate = {
  title: "Rental application",
  description: "Please complete all required fields. Your information is shared only with the property owner.",
  allowCoApplicant: true,
  fields: [
    { id: "firstName", label: "First name", type: "text", required: true, width: "half", system: true },
    { id: "lastName", label: "Surname", type: "text", required: true, width: "half", system: true },
    { id: "idNumber", label: "ID number", type: "text", required: false, width: "half", system: true },
    { id: "phone", label: "Contact number", type: "phone", required: false, width: "half", system: true },
    { id: "email", label: "Email address", type: "email", required: true, width: "full", system: true },
    {
      id: "monthlyIncome",
      label: "Monthly income (after tax)",
      type: "income",
      required: true,
      width: "full",
      system: true
    },
    { id: "previousResidency", label: "Previous residency", type: "text", required: false, width: "full", system: true },
    { id: "landlordContact", label: "Landlord contact details", type: "text", required: false, width: "half", system: true },
    {
      id: "timeRented",
      label: "Time rented",
      type: "text",
      required: false,
      width: "half",
      placeholder: "e.g. 2 years",
      system: true
    }
  ]
};

function slugifyId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "custom_field";
}

export function normalizeApplicantFormTemplate(raw: unknown): ApplicantFormTemplate {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_APPLICANT_FORM_TEMPLATE);
  }
  const obj = raw as Record<string, unknown>;
  const fieldsRaw = Array.isArray(obj.fields) ? obj.fields : [];
  const seen = new Set<string>();
  const fields: ApplicantFormFieldDef[] = [];

  for (const item of fieldsRaw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const id = String(f.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const type = f.type as ApplicantFieldType;
    fields.push({
      id,
      label: String(f.label ?? id).trim() || id,
      type: type === "email" || type === "phone" || type === "income" ? type : "text",
      required: Boolean(f.required),
      width: f.width === "half" ? "half" : "full",
      placeholder: f.placeholder != null ? String(f.placeholder) : undefined,
      system: Boolean(f.system)
    });
  }

  for (const req of REQUIRED_SYSTEM_IDS) {
    if (!seen.has(req)) {
      return structuredClone(DEFAULT_APPLICANT_FORM_TEMPLATE);
    }
  }

  if (!fields.length) {
    return structuredClone(DEFAULT_APPLICANT_FORM_TEMPLATE);
  }

  return {
    title: String(obj.title ?? DEFAULT_APPLICANT_FORM_TEMPLATE.title).trim() || DEFAULT_APPLICANT_FORM_TEMPLATE.title,
    description: String(obj.description ?? ""),
    allowCoApplicant: obj.allowCoApplicant !== false,
    fields
  };
}

export function emptyFieldValues(template: ApplicantFormTemplate): ApplicantFieldValues {
  const values: ApplicantFieldValues = {};
  for (const field of template.fields) {
    values[field.id] = "";
  }
  return values;
}

export function fieldValuesFromRecord(
  template: ApplicantFormTemplate,
  raw: Record<string, unknown> | null | undefined
): ApplicantFieldValues {
  const values = emptyFieldValues(template);
  if (!raw) return values;
  for (const field of template.fields) {
    if (raw[field.id] != null) {
      values[field.id] = String(raw[field.id]);
    }
  }
  return values;
}

export function createCustomFieldId(label: string, existing: ApplicantFormFieldDef[]): string {
  let id = slugifyId(label);
  let n = 2;
  while (existing.some((f) => f.id === id)) {
    id = `${slugifyId(label)}_${n}`;
    n += 1;
  }
  return id;
}

export function validateApplicantFormTemplate(template: ApplicantFormTemplate): string | null {
  if (!template.title.trim()) return "Form title is required.";
  if (!template.fields.length) return "Add at least one form field.";
  for (const field of template.fields) {
    if (!field.label.trim()) return "Every field needs a label.";
  }
  return null;
}

function trimFieldValue(value: string | undefined): string {
  return String(value ?? "").trim();
}

export function validateApplicantApplicationValues(
  template: ApplicantFormTemplate,
  primary: ApplicantFieldValues,
  coApplicantEnabled: boolean,
  coApplicant: ApplicantFieldValues,
  options?: { coEmailRequired?: boolean }
): string | null {
  const coEmailRequired = options?.coEmailRequired ?? false;

  for (const field of template.fields) {
    if (!field.required) continue;
    if (!trimFieldValue(primary[field.id])) {
      return `${field.label} is required.`;
    }
  }

  if (coApplicantEnabled) {
    for (const field of template.fields) {
      const required = field.required && !(field.id === "email" && !coEmailRequired);
      if (!required) continue;
      if (!trimFieldValue(coApplicant[field.id])) {
        return `${field.label} is required for the second applicant.`;
      }
    }
  }

  return null;
}

export function isApplicantApplicationComplete(
  template: ApplicantFormTemplate,
  primary: ApplicantFieldValues,
  coApplicantEnabled: boolean,
  coApplicant: ApplicantFieldValues,
  options?: { coEmailRequired?: boolean }
): boolean {
  return validateApplicantApplicationValues(template, primary, coApplicantEnabled, coApplicant, options) === null;
}

export function combinedIncomeFromValues(template: ApplicantFormTemplate, ...people: ApplicantFieldValues[]): number {
  let total = 0;
  for (const values of people) {
    for (const field of template.fields) {
      if (field.type !== "income") continue;
      const n = Number(String(values[field.id] ?? "").replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) total += n;
    }
  }
  return total;
}

export function personPayloadFromValues(values: ApplicantFieldValues): Record<string, string> {
  return { ...values };
}
