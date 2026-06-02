import { Field, Input, Select } from "../ui/Input";
import type { CalculatorQuestionSection, CalculatorQuestionDef } from "../../data/calculatorQuestionsConfig";

function inputModeForType(t: CalculatorQuestionDef["type"]): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (t === "text") return "text";
  if (t === "percentage" || t === "decimal") return "decimal";
  return "numeric";
}

export function CalculatorQuestionsForm({
  sections,
  values,
  onChange
}: {
  sections: CalculatorQuestionSection[];
  values: Record<string, string>;
  onChange: (key: string, next: string) => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.sectionLabel} style={{ marginBottom: 18 }}>
          <div className="pg-card-title" style={{ marginBottom: 10 }}>
            {section.sectionLabel}
          </div>
          <div className="pg-calculators-q-grid" aria-label={section.sectionLabel}>
            {section.fields.map((f) => (
              <Field key={f.key} label={f.label} help={f.helper}>
                {f.type === "dropdown" ? (
                  <Select
                    value={values[f.key] ?? ""}
                    required={Boolean(f.required)}
                    onChange={(e) => onChange(f.key, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : f.type === "toggle" ? (
                  <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
                    <input
                      type="checkbox"
                      checked={values[f.key] === "true" || values[f.key] === "1"}
                      onChange={(e) => onChange(f.key, e.target.checked ? "true" : "false")}
                      style={{ margin: 0 }}
                    />
                    {values[f.key] === "true" || values[f.key] === "1" ? "Yes" : "No"}
                  </label>
                ) : (
                  <Input
                    inputMode={inputModeForType(f.type)}
                    placeholder={f.placeholder}
                    required={Boolean(f.required)}
                    value={values[f.key] ?? ""}
                    onChange={(e) => onChange(f.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

