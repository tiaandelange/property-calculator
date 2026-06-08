export type ApplicantFieldType = "text" | "email" | "phone" | "income" | "select" | "animals";

export type ApplicantFormFieldDef = {
  id: string;
  label: string;
  type: ApplicantFieldType;
  required: boolean;
  width?: "full" | "half";
  placeholder?: string;
  system?: boolean;
  /** For `select` fields — option values as strings. */
  options?: string[];
};

export type ApplicantFormTemplate = {
  title: string;
  description: string;
  allowCoApplicant: boolean;
  fields: ApplicantFormFieldDef[];
};

export type ApplicantFieldValues = Record<string, string>;

const REQUIRED_SYSTEM_IDS = ["firstName", "lastName", "email", "monthlyIncome"] as const;

export const APPLICANT_ANIMAL_VALUE_KEYS = ["hasAnimals", "catCount", "dogCount"] as const;

/** Household-level fields — only shown on the primary applicant, not co-applicant. */
export const APPLICANT_PRIMARY_ONLY_FIELD_IDS = ["additionalOccupants", "animals"] as const;

export function applicantTemplateForPerson(
  template: ApplicantFormTemplate,
  person: "primary" | "co"
): ApplicantFormTemplate {
  if (person === "primary") return template;
  return {
    ...template,
    fields: template.fields.filter((f) => !APPLICANT_PRIMARY_ONLY_FIELD_IDS.includes(f.id as (typeof APPLICANT_PRIMARY_ONLY_FIELD_IDS)[number]))
  };
}

const ADDITIONAL_OCCUPANTS_FIELD: ApplicantFormFieldDef = {
  id: "additionalOccupants",
  label: "How many additional people will be living at the property?",
  type: "select",
  required: false,
  width: "full",
  system: true,
  options: ["1", "2", "3", "4", "5"]
};

const ANIMALS_FIELD: ApplicantFormFieldDef = {
  id: "animals",
  label: "Pets",
  type: "animals",
  required: false,
  width: "full",
  system: true
};

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
    ADDITIONAL_OCCUPANTS_FIELD,
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
    },
    ANIMALS_FIELD
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

function parseFieldType(raw: unknown): ApplicantFieldType {
  const type = String(raw ?? "text");
  if (type === "email" || type === "phone" || type === "income" || type === "select" || type === "animals") {
    return type;
  }
  return "text";
}

function normalizeFieldDef(f: Record<string, unknown>): ApplicantFormFieldDef | null {
  const id = String(f.id ?? "").trim();
  if (!id) return null;
  const type = parseFieldType(f.type);
  const optionsRaw = f.options;
  const options =
    type === "select" && Array.isArray(optionsRaw)
      ? optionsRaw.map((o) => String(o)).filter(Boolean)
      : type === "select" && id === "additionalOccupants"
        ? ["1", "2", "3", "4", "5"]
        : undefined;

  return {
    id,
    label: String(f.label ?? id).trim() || id,
    type,
    required: Boolean(f.required),
    width: f.width === "half" ? "half" : "full",
    placeholder: f.placeholder != null ? String(f.placeholder) : undefined,
    system: Boolean(f.system),
    options
  };
}

/** Ensures newer system fields exist on older saved templates. */
export function mergeApplicantSystemFields(fields: ApplicantFormFieldDef[]): ApplicantFormFieldDef[] {
  const result = [...fields];

  if (!result.some((f) => f.id === "additionalOccupants")) {
    const incomeIdx = result.findIndex((f) => f.id === "monthlyIncome");
    result.splice(incomeIdx >= 0 ? incomeIdx + 1 : result.length, 0, { ...ADDITIONAL_OCCUPANTS_FIELD });
  }

  if (!result.some((f) => f.id === "animals")) {
    const timeIdx = result.findIndex((f) => f.id === "timeRented");
    const landlordIdx = result.findIndex((f) => f.id === "landlordContact");
    const insertAt =
      timeIdx >= 0 ? timeIdx + 1 : landlordIdx >= 0 ? landlordIdx + 1 : result.length;
    result.splice(insertAt, 0, { ...ANIMALS_FIELD });
  }

  return result;
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
    const field = normalizeFieldDef(item as Record<string, unknown>);
    if (!field || seen.has(field.id)) continue;
    seen.add(field.id);
    fields.push(field);
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
    fields: mergeApplicantSystemFields(fields)
  };
}

export function defaultApplicantFieldValues(): ApplicantFieldValues {
  return {
    hasAnimals: "no",
    catCount: "0",
    dogCount: "0",
    additionalOccupants: ""
  };
}

export function emptyFieldValues(template: ApplicantFormTemplate): ApplicantFieldValues {
  const values = defaultApplicantFieldValues();
  for (const field of template.fields) {
    if (field.type === "animals") continue;
    if (!(field.id in values)) {
      values[field.id] = "";
    }
  }
  return values;
}

export function fieldValuesFromRecord(
  template: ApplicantFormTemplate,
  raw: Record<string, unknown> | null | undefined
): ApplicantFieldValues {
  const values = emptyFieldValues(template);
  if (!raw) return values;

  for (const key of [...APPLICANT_ANIMAL_VALUE_KEYS, "additionalOccupants"]) {
    if (raw[key] != null) {
      values[key] = String(raw[key]);
    }
  }

  for (const field of template.fields) {
    if (field.type === "animals") continue;
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
    if (field.type === "animals") continue;
    if (!field.required) continue;
    if (!trimFieldValue(primary[field.id])) {
      return `${field.label} is required.`;
    }
  }

  if (coApplicantEnabled) {
    for (const field of template.fields) {
      if (field.type === "animals") continue;
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

export function parseAnimalCount(value: string | undefined): number {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function applicantHasAnimals(values: ApplicantFieldValues): boolean {
  return String(values.hasAnimals ?? "").toLowerCase() === "yes";
}

export function formatApplicantAnimalsSummary(values: ApplicantFieldValues): string {
  if (!applicantHasAnimals(values)) return "No pets";
  const cats = parseAnimalCount(values.catCount);
  const dogs = parseAnimalCount(values.dogCount);
  const parts: string[] = [];
  if (cats > 0) parts.push(`${cats} cat${cats === 1 ? "" : "s"}`);
  if (dogs > 0) parts.push(`${dogs} dog${dogs === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "Yes (none specified)";
}

export function formatAdditionalOccupants(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n === 1 ? "1 additional person" : `${n} additional people`;
}
