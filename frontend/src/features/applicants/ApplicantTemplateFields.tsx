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
  return "text";
}

export function ApplicantTemplateFields({
  prefix,
  template,
  values,
  onChange,
  emailRequired = true
}: {
  prefix: string;
  template: ApplicantFormTemplate;
  values: ApplicantFieldValues;
  onChange: (next: ApplicantFieldValues) => void;
  emailRequired?: boolean;
}) {
  const patch = (id: string, value: string) => {
    onChange({ ...values, [id]: value });
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
                    value={values[field.id] ?? ""}
                    onChange={(e) => patch(field.id, e.target.value)}
                    inputMode={inputMode(field)}
                    placeholder={field.placeholder}
                    autoComplete={`${prefix}-${field.id}`}
                    required={field.required && (field.type !== "email" || emailRequired)}
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
              value={values[field.id] ?? ""}
              onChange={(e) => patch(field.id, e.target.value)}
              inputMode={inputMode(field)}
              placeholder={field.placeholder}
              autoComplete={`${prefix}-${field.id}`}
              required={field.required && (field.type !== "email" || emailRequired)}
            />
          </Field>
        );
      })}
    </div>
  );
}
