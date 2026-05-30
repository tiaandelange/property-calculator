import { Field, Input } from "../../components/ui/Input";
import type { ApplicantFieldValues, ApplicantFormFieldDef, ApplicantFormTemplate } from "./applicantFormTemplate";

function inputMode(field: ApplicantFormFieldDef): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (field.type === "phone") return "tel";
  if (field.type === "income") return "decimal";
  return field.type === "email" ? "email" : "text";
}

function inputType(field: ApplicantFormFieldDef): string {
  if (field.type === "email") return "email";
  if (field.type === "phone") return "tel";
  if (field.type === "income") return "number";
  return "text";
}

function sanitizeIncomeInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function fieldValue(field: ApplicantFormFieldDef, values: ApplicantFieldValues): string {
  return values[field.id] ?? "";
}

function patchField(field: ApplicantFormFieldDef, value: string): string {
  return field.type === "income" ? sanitizeIncomeInput(value) : value;
}

export function ApplicantTemplateFields({
  prefix,
  template,
  values,
  onChange,
  emailRequired = true,
  disabled = false
}: {
  prefix: string;
  template: ApplicantFormTemplate;
  values: ApplicantFieldValues;
  onChange: (next: ApplicantFieldValues) => void;
  emailRequired?: boolean;
  disabled?: boolean;
}) {
  const patch = (id: string, field: ApplicantFormFieldDef, value: string) => {
    onChange({ ...values, [id]: patchField(field, value) });
  };

  const rows: ApplicantFormFieldDef[][] = [];
  let pendingHalf: ApplicantFormFieldDef | null = null;

  for (const field of template.fields) {
    if (field.width === "half") {
      if (pendingHalf) {
        rows.push([pendingHalf, field]);
        pendingHalf = null;
      } else {
        pendingHalf = field;
      }
    } else {
      if (pendingHalf) {
        rows.push([pendingHalf]);
        pendingHalf = null;
      }
      rows.push([field]);
    }
  }
  if (pendingHalf) rows.push([pendingHalf]);

  const incomeProps = (field: ApplicantFormFieldDef) =>
    field.type === "income"
      ? {
          min: 0,
          step: "0.01",
          placeholder: field.placeholder ?? "0.00"
        }
      : { placeholder: field.placeholder };

  return (
    <div className="pg-applicant-person-fields">
      {rows.map((row) => {
        const rowKey = row.map((f) => f.id).join("-");
        if (row.length === 2) {
          return (
            <div key={rowKey} className="pg-applicant-person-fields__row">
              {row.map((field) => (
                <Field key={field.id} label={field.label}>
                  <Input
                    type={inputType(field)}
                    value={fieldValue(field, values)}
                    onChange={(e) => patch(field.id, field, e.target.value)}
                    inputMode={inputMode(field)}
                    autoComplete={`${prefix}-${field.id}`}
                    required={field.required && (field.type !== "email" || emailRequired)}
                    disabled={disabled}
                    {...incomeProps(field)}
                  />
                </Field>
              ))}
            </div>
          );
        }
        const field = row[0];
        return (
          <Field key={field.id} label={field.label}>
            <Input
              type={inputType(field)}
              value={fieldValue(field, values)}
              onChange={(e) => patch(field.id, field, e.target.value)}
              inputMode={inputMode(field)}
              autoComplete={`${prefix}-${field.id}`}
              required={field.required && (field.type !== "email" || emailRequired)}
              disabled={disabled}
              {...incomeProps(field)}
            />
          </Field>
        );
      })}
    </div>
  );
}
