import type { UiColorScheme } from "../../theme/uiColorScheme";

type Props = {
  value: UiColorScheme;
  onChange: (next: UiColorScheme) => void;
  disabled?: boolean;
  id?: string;
};

/** Accessible toggle: off = dark interface, on = light interface. */
export function UiColorSchemeSwitch({ value, onChange, disabled, id }: Props) {
  const isLight = value === "light";
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      disabled={disabled}
      className="pg-color-scheme-switch"
      data-on={isLight ? "true" : "false"}
      onClick={() => onChange(isLight ? "dark" : "light")}
    >
      <span className="pg-color-scheme-switch-track" aria-hidden>
        <span className="pg-color-scheme-switch-thumb" />
      </span>
      <span className="pg-color-scheme-switch-labels">
        <span data-active={!isLight ? "true" : "false"}>Dark</span>
        <span data-active={isLight ? "true" : "false"}>Light</span>
      </span>
    </button>
  );
}
