import type { FieldDef } from "../../../data/calculators";
import { getCalculatedFieldHint, isCalculatedFieldDisplay } from "../../../data/calculatorFieldLayout";
import { cleanCalculatorFieldLabel } from "../../../data/calculatorFieldPresentation";
import { Field } from "../../ui/Input";
import { CalculatorToolInputControl } from "./CalculatorToolInputControl";

type CalculatorToolFieldRendererProps = {
  slug: string;
  field: FieldDef;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

export function CalculatorToolFieldRenderer({ slug, field, values, onChange }: CalculatorToolFieldRendererProps) {
  const calculated = isCalculatedFieldDisplay(slug, field.key, values);
  const calcHint = getCalculatedFieldHint(slug, field.key, values);
  const help = calcHint ?? field.help;
  const label = cleanCalculatorFieldLabel(field.label);

  return (
    <div className={`pg-calc-tool-field${calculated ? " pg-calc-tool-field--calculated" : ""}`}>
      <Field label={label} help={help}>
        <CalculatorToolInputControl
          slug={slug}
          field={field}
          value={values[field.key]}
          calculated={calculated}
          onChange={(v) => onChange(field.key, v)}
        />
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
