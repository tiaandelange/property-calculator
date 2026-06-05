import type { FieldDef } from "../../../data/calculators";
import {
  formatCalculatorNumericDisplay,
  getCalculatorFieldAdornment,
  getCalculatorFieldSlider,
  parseCalculatorNumericInput
} from "../../../data/calculatorFieldPresentation";
import { selectFieldCoerceValue } from "../../../pages/calculatorFieldHelpers";

type CalculatorToolInputControlProps = {
  slug: string;
  field: FieldDef;
  value: unknown;
  calculated?: boolean;
  onChange: (value: unknown) => void;
};

export function CalculatorToolInputControl({
  slug,
  field,
  value,
  calculated,
  onChange
}: CalculatorToolInputControlProps) {
  const adornment = getCalculatorFieldAdornment(field);
  const slider = getCalculatorFieldSlider(slug, field.key);
  const inputClass = ["pg-calc-tool-input", calculated ? "pg-calc-tool-input--calculated" : ""]
    .filter(Boolean)
    .join(" ");

  const numericValue = formatCalculatorNumericDisplay(value);
  const sliderNum =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : value === "" || value == null
        ? slider?.min ?? 0
        : Number(value) || slider?.min || 0;

  const handleNumericChange = (raw: string) => {
    const parsed = parseCalculatorNumericInput(raw);
    onChange(parsed === "" ? "" : parsed);
  };

  const fieldInner =
    field.type === "select" ? (
      <select
        className={inputClass}
        value={String(value ?? "")}
        required={Boolean(field.required)}
        onChange={(e) => onChange(selectFieldCoerceValue(field, e.target.value))}
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
      <label className="pg-calc-tool-checkbox">
        <input
          type="checkbox"
          className="pg-calc-tool-checkbox__input"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{value ? "Yes" : "No"}</span>
      </label>
    ) : field.type === "text" ? (
      <input
        type="text"
        className={inputClass}
        placeholder={field.placeholder}
        value={String(value ?? "")}
        required={Boolean(field.required)}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input
        type="text"
        inputMode="decimal"
        className={inputClass}
        placeholder={field.placeholder}
        required={Boolean(field.required)}
        value={numericValue}
        onChange={(e) => handleNumericChange(e.target.value)}
      />
    );

  const wrapped =
    adornment.prefix || adornment.suffix ? (
      <div
        className={[
          "pg-calc-tool-input-wrap",
          adornment.prefix ? "pg-calc-tool-input-wrap--prefix" : "",
          adornment.suffix ? "pg-calc-tool-input-wrap--suffix" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {adornment.prefix ? (
          <span className="pg-calc-tool-input-wrap__affix pg-calc-tool-input-wrap__affix--prefix">{adornment.prefix}</span>
        ) : null}
        {fieldInner}
        {adornment.suffix ? (
          <span className="pg-calc-tool-input-wrap__affix pg-calc-tool-input-wrap__affix--suffix">{adornment.suffix}</span>
        ) : null}
      </div>
    ) : (
      fieldInner
    );

  if (!slider || field.type === "select" || field.type === "checkbox" || field.type === "text") {
    return wrapped;
  }

  return (
    <div className="pg-calc-tool-input-with-slider">
      {wrapped}
      <input
        type="range"
        className="pg-calc-tool-slider"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={Math.min(slider.max, Math.max(slider.min, sliderNum))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${field.label} slider`}
      />
    </div>
  );
}
