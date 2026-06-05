import type { FieldDef } from "../../../data/calculators";
import { getCalculatedFieldHint, isCalculatedFieldDisplay } from "../../../data/calculatorFieldLayout";
import { Field, Input } from "../../ui/Input";
import { selectFieldCoerceValue } from "../../../pages/calculatorFieldHelpers";

type CalculatorToolFieldRendererProps = {
  slug: string;
  field: FieldDef;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

export function CalculatorToolFieldRenderer({ slug, field, values, onChange }: CalculatorToolFieldRendererProps) {
  const calculated = isCalculatedFieldDisplay(slug, field.key, values);
  const calcHint = getCalculatedFieldHint(slug, field.key, values);
  const help = calcHint ?? field.help ?? "Use realistic, conservative assumptions.";

  return (
    <div className={calculated ? "pg-calc-tool-field--calculated" : undefined}>
      <Field label={field.label} help={help}>
      {field.type === "select" ? (
        <select
          className={`pg-input${calculated ? " pg-input--calculated" : ""}`}
          value={String(values[field.key] ?? "")}
          required={Boolean(field.required)}
          onChange={(e) => onChange(field.key, selectFieldCoerceValue(field, e.target.value))}
        >
          <option value="" disabled>
            Select…
          </option>
          {(field.options ?? []).map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "checkbox" ? (
        <label className="pg-pill pg-calc-tool-checkbox" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
          <input
            type="checkbox"
            checked={Boolean(values[field.key])}
            onChange={(e) => onChange(field.key, e.target.checked)}
            style={{ margin: 0 }}
          />
          {values[field.key] ? "Yes" : "No"}
        </label>
      ) : field.type === "text" ? (
        <Input
          type="text"
          className={calculated ? "pg-input pg-input--calculated" : undefined}
          placeholder={field.placeholder}
          value={String(values[field.key] ?? "")}
          required={Boolean(field.required)}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : (
        <Input
          type="number"
          className={calculated ? "pg-input pg-input--calculated" : undefined}
          placeholder={field.placeholder}
          required={Boolean(field.required)}
          value={values[field.key] ?? ""}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
        />
      )}
      </Field>
    </div>
  );
}

export function renderCalculatorFieldsByKeys(
  slug: string,
  allFields: FieldDef[],
  keys: string[],
  values: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void
) {
  const fieldMap = new Map(allFields.map((f) => [f.key, f]));
  return keys
    .map((key) => fieldMap.get(key))
    .filter(Boolean)
    .map((field) => (
      <CalculatorToolFieldRenderer
        key={field!.key}
        slug={slug}
        field={field!}
        values={values}
        onChange={onChange}
      />
    ));
}
