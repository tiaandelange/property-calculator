import { Field, Input, Select } from "../../components/ui/Input";
import type { ApplicantFieldValues, ApplicantFormFieldDef, ApplicantFormTemplate } from "./applicantFormTemplate";
import { applicantHasAnimals } from "./applicantFormTemplate";

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

function sanitizeCountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "0";
  return String(Number.parseInt(digits, 10));
}

function fieldValue(field: ApplicantFormFieldDef, values: ApplicantFieldValues): string {
  return values[field.id] ?? "";
}

function patchField(field: ApplicantFormFieldDef, value: string): string {
  return field.type === "income" ? sanitizeIncomeInput(value) : value;
}

function ApplicantAnimalsField({
  values,
  onChange,
  disabled
}: {
  values: ApplicantFieldValues;
  onChange: (next: ApplicantFieldValues) => void;
  disabled?: boolean;
}) {
  const hasAnimals = applicantHasAnimals(values);

  const setHasAnimals = (next: boolean) => {
    if (!next) {
      onChange({ ...values, hasAnimals: "no", catCount: "0", dogCount: "0" });
      return;
    }
    onChange({
      ...values,
      hasAnimals: "yes",
      catCount: values.catCount ?? "0",
      dogCount: values.dogCount ?? "0"
    });
  };

  return (
    <div className="pg-applicant-animals-field">
      <Field label="Do you have any pets?">
        <div className="pg-applicant-toggle" role="group" aria-label="Do you have any pets?">
          <button
            type="button"
            className={`pg-applicant-toggle__btn${!hasAnimals ? " is-active" : ""}`}
            aria-pressed={!hasAnimals}
            disabled={disabled}
            onClick={() => setHasAnimals(false)}
          >
            No
          </button>
          <button
            type="button"
            className={`pg-applicant-toggle__btn${hasAnimals ? " is-active" : ""}`}
            aria-pressed={hasAnimals}
            disabled={disabled}
            onClick={() => setHasAnimals(true)}
          >
            Yes
          </button>
        </div>
      </Field>
      {hasAnimals ? (
        <div className="pg-applicant-animals-field__counts">
          <Field label="Cats">
            <Input
              type="number"
              min={0}
              step={1}
              value={values.catCount ?? "0"}
              onChange={(e) => onChange({ ...values, catCount: sanitizeCountInput(e.target.value) })}
              disabled={disabled}
            />
          </Field>
          <Field label="Dogs">
            <Input
              type="number"
              min={0}
              step={1}
              value={values.dogCount ?? "0"}
              onChange={(e) => onChange({ ...values, dogCount: sanitizeCountInput(e.target.value) })}
              disabled={disabled}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function renderFieldControl(
  field: ApplicantFormFieldDef,
  values: ApplicantFieldValues,
  patch: (id: string, field: ApplicantFormFieldDef, value: string) => void,
  opts: {
    prefix: string;
    emailRequired: boolean;
    disabled: boolean;
    onChange: (next: ApplicantFieldValues) => void;
  }
) {
  if (field.type === "animals") {
    return <ApplicantAnimalsField values={values} onChange={opts.onChange} disabled={opts.disabled} />;
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    return (
      <Field label={field.label}>
        <Select
          value={fieldValue(field, values)}
          onChange={(e) => patch(field.id, field, e.target.value)}
          disabled={opts.disabled}
          required={field.required}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  const incomeProps =
    field.type === "income"
      ? {
          min: 0,
          step: "0.01",
          placeholder: field.placeholder ?? "0.00"
        }
      : { placeholder: field.placeholder };

  return (
    <Field label={field.label}>
      <Input
        type={inputType(field)}
        value={fieldValue(field, values)}
        onChange={(e) => patch(field.id, field, e.target.value)}
        inputMode={inputMode(field)}
        autoComplete={`${opts.prefix}-${field.id}`}
        required={field.required && (field.type !== "email" || opts.emailRequired)}
        disabled={opts.disabled}
        {...incomeProps}
      />
    </Field>
  );
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
    if (field.width === "half" && field.type !== "animals" && field.type !== "select") {
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

  const controlOpts = { prefix, emailRequired, disabled, onChange };

  return (
    <div className="pg-applicant-person-fields">
      {rows.map((row) => {
        const rowKey = row.map((f) => f.id).join("-");
        if (row.length === 2 && row.every((f) => f.type !== "animals" && f.type !== "select")) {
          return (
            <div key={rowKey} className="pg-applicant-person-fields__row">
              {row.map((field) => (
                <div key={field.id}>{renderFieldControl(field, values, patch, controlOpts)}</div>
              ))}
            </div>
          );
        }
        const field = row[0];
        return <div key={rowKey}>{renderFieldControl(field, values, patch, controlOpts)}</div>;
      })}
    </div>
  );
}
